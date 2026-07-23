import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for AES-GCM

/**
 * Returns a 32-byte Buffer key from ENCRYPTION_KEY env var
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  if (keyEnv.length === 64) {
    return Buffer.from(keyEnv, 'hex')
  }
  return Buffer.alloc(32, keyEnv, 'utf-8')
}

export interface EncryptedPayload {
  iv: string        // Base64 encoded
  ciphertext: string// Base64 encoded
  tag: string       // Base64 encoded
}

/**
 * Encrypts plaintext string using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')
  const tag = cipher.getAuthTag().toString('base64')

  return {
    iv: iv.toString('base64'),
    ciphertext,
    tag,
  }
}

/**
 * Decrypts AES-256-GCM encrypted payload back to plaintext string
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}
