import twilio from 'twilio'

let twilioClient: twilio.Twilio | null = null

function getTwilioClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token || sid.includes('00000000')) {
    return null
  }

  twilioClient = twilio(sid, token)
  return twilioClient
}

/**
 * Sends an SMS message to a patient phone number
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient()
  const from = process.env.TWILIO_PHONE_NUMBER || '+27000000000'

  if (!client) {
    console.log(`[Twilio SMS (Mock Mode)] To: ${to} | Message: "${body}"`)
    return true
  }

  try {
    const msg = await client.messages.create({
      to,
      from,
      body,
    })
    console.log(`[Twilio SMS] Message sent to ${to}, SID: ${msg.sid}`)
    return true
  } catch (error) {
    console.error(`[Twilio SMS Error] Failed sending SMS to ${to}:`, error)
    return false
  }
}
