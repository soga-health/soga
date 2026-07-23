import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendSMS } from '../../../../services/twilio'

interface PatientRel {
  id: string
  phoneNumber?: string
}

interface DoctorRel {
  id: string
  name?: string
}

export async function GET(req: Request) {
  try {
    // Verify CRON_SECRET if configured (Vercel Crons sends Authorization: Bearer <CRON_SECRET>)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
    }

    const payload = await getPayload({ config })

    // Calculate date window for "tomorrow"
    const now = new Date()
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59)

    // Query scheduled visits for tomorrow
    const visitsResult = await payload.find({
      collection: 'visits',
      where: {
        status: { equals: 'scheduled' },
        date: {
          greater_than_equal: tomorrowStart.toISOString(),
          less_than_equal: tomorrowEnd.toISOString(),
        },
      },
      depth: 2,
    })

    let remindersSent = 0

    for (const visit of visitsResult.docs) {
      try {
        const patientDoc = visit.patientId as unknown as PatientRel | undefined
        const doctorDoc = visit.doctorId as unknown as DoctorRel | undefined

        if (!patientDoc || !patientDoc.phoneNumber) continue

        const doctorName = doctorDoc?.name ? `Dr. ${doctorDoc.name}` : 'your doctor'
        const visitTime = new Date(visit.date).toLocaleTimeString('en-ZA', {
          hour: '2-digit',
          minute: '2-digit',
        })

        const smsText = `Reminder from Soga Healthcare: Your appointment with ${doctorName} is scheduled for tomorrow at ${visitTime}.`

        await sendSMS(patientDoc.phoneNumber, smsText)
        remindersSent++
      } catch (err) {
        console.error(`[Cron Reminders Error] Failed sending reminder for visit ID ${visit.id}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      visitsFound: visitsResult.docs.length,
      remindersSent,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Cron Reminders Handler Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
