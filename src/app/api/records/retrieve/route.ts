import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { decrypt, EncryptedPayload } from '../../../../services/encryption'
import { getTopicMessages } from '../../../../services/hedera'

/**
 * Decrypts all messages from a single HCS topic.
 * Returns an array of parsed record objects.
 */
async function decryptTopicRecords(topicId: string): Promise<unknown[]> {
  const rawMessages = await getTopicMessages(topicId)
  const decryptedRecords: unknown[] = []

  for (const rawMsg of rawMessages) {
    try {
      const encryptedData: EncryptedPayload = JSON.parse(rawMsg)
      const decryptedText = decrypt(encryptedData)
      decryptedRecords.push(JSON.parse(decryptedText))
    } catch (err) {
      console.warn(`[Records Retrieve] Unable to decrypt raw message on topic ${topicId}:`, err)
    }
  }

  return decryptedRecords
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const category = searchParams.get('category') // optional — omit or 'all' to get everything

    if (!patientId) {
      return NextResponse.json({ error: 'patientId query parameter is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const patientResult = await payload.find({
      collection: 'patients',
      where: {
        or: [
          { patientId: { equals: patientId } },
          { id: { equals: patientId } },
        ],
      },
      limit: 1,
    })

    if (!patientResult.docs.length) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const patient = patientResult.docs[0]
    const topics: Array<{ category: string; topicId: string }> = patient.topicsArray || []

    // ── Single category mode ──────────────────────────────────────────
    if (category && category.toLowerCase() !== 'all') {
      const topicObj = topics.find((t) => t.category.toLowerCase() === category.toLowerCase())

      if (!topicObj) {
        return NextResponse.json({
          success: true,
          patientId: patient.patientId,
          category,
          records: [],
        })
      }

      const decryptedRecords = await decryptTopicRecords(topicObj.topicId)

      return NextResponse.json({
        success: true,
        patientId: patient.patientId,
        category,
        topicId: topicObj.topicId,
        recordsCount: decryptedRecords.length,
        records: decryptedRecords,
      })
    }

    // ── All topics mode (no category or category=all) ─────────────────
    if (!topics.length) {
      return NextResponse.json({
        success: true,
        patientId: patient.patientId,
        categories: [],
        totalRecordsCount: 0,
      })
    }

    // Fetch records from all topics in parallel
    const results = await Promise.all(
      topics.map(async (topicObj) => {
        const records = await decryptTopicRecords(topicObj.topicId)
        return {
          category: topicObj.category,
          topicId: topicObj.topicId,
          recordsCount: records.length,
          records,
        }
      })
    )

    const totalRecordsCount = results.reduce((sum, r) => sum + r.recordsCount, 0)

    return NextResponse.json({
      success: true,
      patientId: patient.patientId,
      totalRecordsCount,
      categories: results,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Records Retrieve Endpoint Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

