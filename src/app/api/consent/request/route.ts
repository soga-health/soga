import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateOTPCode, getOTPExpiryDate } from '../../../../services/otp'
import { sendSMS } from '../../../../services/twilio'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { patientId, doctorId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Find patient by patientId or MongoDB ID
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
    let doctorName = 'Smith'
    let docObjId = doctorId

    if (doctorId) {
      const doctorResult = await payload.find({
        collection: 'doctors',
        where: {
          or: [
            { doctorId: { equals: doctorId } },
            { id: { equals: doctorId } },
          ],
        },
        limit: 1,
      })

      if (doctorResult.docs.length) {
        doctorName = doctorResult.docs[0].name
        docObjId = doctorResult.docs[0].id
      }
    }

    const otpCode = generateOTPCode()
    const expiresAt = getOTPExpiryDate(10)

    // Save OTP to database
    await payload.create({
      collection: 'otp-logs',
      data: {
        phoneNumber: patient.phoneNumber,
        otpCode,
        expiresAt: expiresAt.toISOString(),
        isValid: true,
        patientId: patient.id,
        doctorId: docObjId || undefined,
      },
    })

    // Send SMS to patient via Twilio
    const smsMessage = `Your consent code for Dr. ${doctorName} is ${otpCode}. It is valid for 10 minutes.`
    await sendSMS(patient.phoneNumber, smsMessage)

    return NextResponse.json({
      success: true,
      message: `Consent code sent to patient ${patient.name} (${patient.phoneNumber})`,
      expiresAt,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consent Request Endpoint Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
