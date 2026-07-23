import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { decrypt, EncryptedPayload } from '../../../../services/encryption'
import { getTopicMessages } from '../../../../services/hedera'

interface PatientDoc {
  id: string
  patientId: string
  phoneNumber: string
  topicsArray?: Array<{ category: string; topicId: string }>
}

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { patientId, otpCode } = body

    if (!patientId || !otpCode) {
      return NextResponse.json({ error: 'patientId and otpCode are required' }, { status: 400 })
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

    const patient = patientResult.docs[0] as unknown as PatientDoc

    // Verify OTP against OTPLogs
    const otpResult = await payload.find({
      collection: 'otp-logs',
      where: {
        phoneNumber: { equals: patient.phoneNumber },
        otpCode: { equals: otpCode },
        isValid: { equals: true },
      },
      sort: '-createdAt',
      limit: 1,
    })

    if (!otpResult.docs.length) {
      return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 401 })
    }

    const otpDoc = otpResult.docs[0]

    // Check expiration
    if (new Date(otpDoc.expiresAt) < new Date()) {
      // Invalidate expired OTP
      await payload.update({
        collection: 'otp-logs',
        id: otpDoc.id,
        data: { isValid: false },
      })
      return NextResponse.json({ error: 'OTP code has expired' }, { status: 401 })
    }

    // Mark OTP as used
    await payload.update({
      collection: 'otp-logs',
      id: otpDoc.id,
      data: { isValid: false },
    })

    const topics: Array<{ category: string; topicId: string }> = patient.topicsArray || []

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
