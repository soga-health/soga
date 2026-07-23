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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { phoneNumber, otpCode, patientId, category = 'doctorReports' } = body

    if (!otpCode || (!phoneNumber && !patientId)) {
      return NextResponse.json({ error: 'otpCode and (phoneNumber or patientId) are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Find patient to resolve phone number & topics
    let patient: PatientDoc | null = null
    if (patientId) {
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
      if (patientResult.docs.length) {
        patient = patientResult.docs[0] as unknown as PatientDoc
      }
    }

    const targetPhone = phoneNumber || patient?.phoneNumber

    if (!targetPhone) {
      return NextResponse.json({ error: 'Patient phone number could not be resolved' }, { status: 404 })
    }

    // Verify OTP against OTPLogs
    const otpResult = await payload.find({
      collection: 'otp-logs',
      where: {
        phoneNumber: { equals: targetPhone },
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

    if (!patient) {
      const patientByPhone = await payload.find({
        collection: 'patients',
        where: { phoneNumber: { equals: targetPhone } },
        limit: 1,
      })
      if (patientByPhone.docs.length) {
        patient = patientByPhone.docs[0] as unknown as PatientDoc
      }
    }

    if (!patient) {
      return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })
    }

    // Find requested topic ID
    const topics: Array<{ category: string; topicId: string }> = patient.topicsArray || []
    const topicObj = topics.find((t) => t.category.toLowerCase() === category.toLowerCase())

    if (!topicObj) {
      return NextResponse.json({
        success: true,
        message: `Consent verified successfully, but no Hedera topic exists for category '${category}'`,
        records: [],
      })
    }

    // Retrieve encrypted messages from Hedera mirror node
    const rawMessages = await getTopicMessages(topicObj.topicId)
    const decryptedRecords: unknown[] = []

    for (const rawMsg of rawMessages) {
      try {
        const encryptedData: EncryptedPayload = JSON.parse(rawMsg)
        const decryptedText = decrypt(encryptedData)
        decryptedRecords.push(JSON.parse(decryptedText))
      } catch (err) {
        console.warn(`[Consent Verify] Failed to decrypt message on topic ${topicObj.topicId}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      patientId: patient.patientId,
      category,
      topicId: topicObj.topicId,
      recordsCount: decryptedRecords.length,
      records: decryptedRecords,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consent Verify Endpoint Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
