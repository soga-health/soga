import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let fromNumber = ''
    let bodyText = ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      fromNumber = formData.get('From')?.toString() || ''
      bodyText = formData.get('Body')?.toString() || ''
    } else {
      const json = await req.json().catch(() => ({}))
      fromNumber = json.From || json.from || ''
      bodyText = json.Body || json.body || ''
    }

    console.log(`[Twilio Webhook] Received SMS from: ${fromNumber} | Body: "${bodyText}"`)

    const payload = await getPayload({ config })

    // Find patient by phone number
    const patientResult = await payload.find({
      collection: 'patients',
      where: {
        phoneNumber: { equals: fromNumber },
      },
      limit: 1,
    })

    let replyMessage: string

    if (!patientResult.docs.length) {
      replyMessage = `Sorry, no Soga account was found associated with phone number ${fromNumber}. Please contact your healthcare provider.`
    } else {
      const patient = patientResult.docs[0]
      const trimmedBody = bodyText.trim()

      if (trimmedBody === '5' || trimmedBody.toUpperCase() === 'ID' || trimmedBody.toUpperCase().includes('SOGA ID')) {
        replyMessage = `Hello ${patient.name}, your Soga ID is: ${patient.patientId}`
      } else {
        replyMessage = `Welcome to Soga Healthcare. Reply '5' or 'ID' to receive your Soga Patient ID.`
      }
    }

    // Format TwiML XML response for Twilio Messaging webhook
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>`

    return new Response(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[Twilio Webhook Error]', err)

    const twimlError = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>An error occurred processing your request. Please try again later.</Message>
</Response>`

    return new Response(twimlError, {
      status: 500,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}
