import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { encrypt } from '../../../../services/encryption'
import { createTopic, submitTopicMessage } from '../../../../services/hedera'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { patientId, category, doctorId, data } = body

    if (!patientId || !category || !data) {
      return NextResponse.json({ error: 'patientId, category, and data payload are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Look up patient
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

    const targetTopicObj = topics.find((t) => t.category.toLowerCase() === category.toLowerCase())
    let topicId: string

    // Dynamic Topic creation if category does not exist yet
    if (!targetTopicObj) {
      console.log(`[Record Submit] Category '${category}' not found for patient ${patient.patientId}. Creating dynamic Hedera topic...`)
      topicId = await createTopic(`${category} - ${patient.patientId}`)
      
      const updatedTopics = [...topics, { category, topicId }]
      await payload.update({
        collection: 'patients',
        id: patient.id,
        data: {
          topicsArray: updatedTopics,
        },
      })
    } else {
      topicId = targetTopicObj.topicId
    }

    // Encrypt sensitivity data (PHI/PII) using AES-256-GCM
    const recordPayload = {
      record: data,
      doctorId: doctorId || 'DOC-UNSPECIFIED',
      timestamp: new Date().toISOString(),
    }

    const encrypted = encrypt(JSON.stringify(recordPayload))

    // Submit encrypted payload to Hedera Consensus Service
    const submitStatus = await submitTopicMessage(topicId, JSON.stringify(encrypted))

    return NextResponse.json({
      success: true,
      message: 'Medical record encrypted and successfully submitted to Hedera HCS',
      patientId: patient.patientId,
      category,
      status: submitStatus,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Record Submit Endpoint Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
