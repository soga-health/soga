import { customAlphabet } from 'nanoid'

// Custom nanoid generator for 8 alphanumeric uppercase characters
const nanoidAlpha = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8)

/**
 * Generates patient ID in the SOG-XXXXXXXX format (e.g. SOG-9A8B7C6D)
 */
export function generatePatientId(): string {
  return `SOG-${nanoidAlpha()}`
}

/**
 * Generates a random 4-digit numeric OTP code
 */
export function generateOTPCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * Calculates expiry timestamp (defaults to 10 minutes from now)
 */
export function getOTPExpiryDate(minutes = 10): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() + minutes)
  return date
}
