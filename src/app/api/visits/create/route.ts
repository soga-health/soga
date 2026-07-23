import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { patientId, doctorId, date, status } = body

    if (!patientId || !doctorId || !date) {
      return NextResponse.json({ error: 'patientId, doctorId, and date are required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Find the patient's MongoDB ObjectId by their string patientId (e.g., SOG-1234)
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
      return NextResponse.json({ error: `Patient with ID ${patientId} not found` }, { status: 404 })
    }

    const patientObjectId = patientResult.docs[0].id

    // Find the doctor's MongoDB ObjectId by their string doctorId (e.g., DOC-1234)
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

    if (!doctorResult.docs.length) {
      return NextResponse.json({ error: `Doctor with ID ${doctorId} not found` }, { status: 404 })
    }

    const doctorObjectId = doctorResult.docs[0].id

    // Create the visit using the resolved MongoDB ObjectIds
    const visit = await payload.create({
      collection: 'visits',
      data: {
        patientId: patientObjectId,
        doctorId: doctorObjectId,
        date,
        status: status || 'scheduled',
      },
    })

    return NextResponse.json({
      message: 'Visit created successfully',
      doc: visit,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Visits Create Endpoint Error]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
