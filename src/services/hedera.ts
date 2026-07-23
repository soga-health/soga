import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, AccountId, PrivateKey } from '@hashgraph/sdk'

let clientInstance: Client | null = null

/** Maximum number of retry attempts for transient transaction failures */
const MAX_RETRIES = 3

/** Transaction valid duration in seconds (default SDK is 120s, which can be tight) */
const TRANSACTION_VALID_DURATION_SECONDS = 180

/**
 * Returns lazy singleton Hedera Client instance for Testnet.
 * Configures request timeout and max retry attempts on the client.
 */
export function getHederaClient(): Client {
  if (clientInstance) return clientInstance

  const accountId = process.env.HEDERA_ACCOUNT_ID
  const privateKey = process.env.HEDERA_PRIVATE_KEY

  if (!accountId || !privateKey || accountId.includes('123456')) {
    console.warn('[Hedera] Using default/mock Hedera Testnet credentials. Real operations will require valid HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY.')
  }

  const client = Client.forTestnet()

  // Increase request timeout and node selection resilience
  client.setRequestTimeout(30_000) // 30 seconds
  client.setMaxAttempts(5) // retry node-level gRPC failures

  if (accountId && privateKey && !accountId.includes('123456')) {
    client.setOperator(
      AccountId.fromString(accountId),
      PrivateKey.fromStringDer(privateKey)
    )
  }

  clientInstance = client
  return clientInstance
}

/**
 * Resets the singleton client instance.
 * Useful when credentials rotate or the client enters a bad state.
 */
export function resetHederaClient(): void {
  if (clientInstance) {
    clientInstance.close()
  }
  clientInstance = null
}

/**
 * Creates a new Hedera HCS Topic and returns the topic ID string (e.g., "0.0.12345")
 */
export async function createTopic(memo?: string): Promise<string> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Get a fresh client reference each attempt (important if the singleton
      // was reset between iterations).
      const client = getHederaClient()

      // Build a fresh transaction each attempt so the embedded timestamp is current
      let tx = new TopicCreateTransaction()
        .setTransactionValidDuration(TRANSACTION_VALID_DURATION_SECONDS)
      if (memo) {
        tx = tx.setTopicMemo(memo)
      }

      // Explicitly freeze before execute to avoid
      // "transaction must have been frozen before calculating the hash" errors
      tx.freezeWith(client)
      const response = await tx.execute(client)
      const receipt = await response.getReceipt(client)
      const topicId = receipt.topicId?.toString()

      if (!topicId) {
        throw new Error('Hedera topic creation succeeded but topic ID was null')
      }

      console.log(`[Hedera HCS] Created topic: ${topicId} ${memo ? `(${memo})` : ''}`)
      return topicId
    } catch (error: unknown) {
      lastError = error
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('TRANSACTION_EXPIRED') ||
         error.message.includes('BUSY') ||
         error.message.includes('PLATFORM_TRANSACTION_NOT_CREATED'))

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = 1500 * attempt
        console.warn(
          `[Hedera HCS] Transient error on createTopic attempt ${attempt}/${MAX_RETRIES}: ` +
          `${error instanceof Error ? error.message.slice(0, 80) : error}. ` +
          `Retrying in ${delayMs}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      break
    }
  }

  console.error('[Hedera HCS] Error creating topic after all retries:', lastError)
  // Fallback mock topic ID for local dev if network call fails/mock key used
  const mockTopicId = `0.0.mock-${Date.now()}`
  console.log(`[Hedera HCS Fallback] Using mock topic ID: ${mockTopicId}`)
  return mockTopicId
}

/**
 * Submits a string message (e.g., JSON of EncryptedPayload) to an HCS topic.
 * Retries up to MAX_RETRIES times on TRANSACTION_EXPIRED errors, generating
 * a fresh transaction (and therefore a fresh transaction ID / timestamp) on each attempt.
 */
export async function submitTopicMessage(topicId: string, message: string): Promise<string> {
  if (topicId.startsWith('0.0.mock')) {
    console.log(`[Hedera HCS Fallback] Submitted message to mock topic ${topicId}`)
    return '0.0.mock-seq-1'
  }

  const client = getHederaClient()
  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Build a fresh transaction on every attempt so the transaction ID
      // (which embeds the current timestamp) is regenerated.
      const response = await new TopicMessageSubmitTransaction({
        topicId,
        message,
      })
        .setTransactionValidDuration(TRANSACTION_VALID_DURATION_SECONDS)
        .execute(client)

      const receipt = await response.getReceipt(client)
      console.log(`[Hedera HCS] Submitted message to topic ${topicId}, status: ${receipt.status}`)
      return receipt.status.toString()
    } catch (error: unknown) {
      lastError = error
      const isExpired =
        error instanceof Error &&
        (error.message.includes('TRANSACTION_EXPIRED') || error.message.includes('StatusError'))

      if (isExpired && attempt < MAX_RETRIES) {
        const delayMs = 1000 * attempt // linear backoff: 1s, 2s, ...
        console.warn(
          `[Hedera HCS] TRANSACTION_EXPIRED on attempt ${attempt}/${MAX_RETRIES} for topic ${topicId}. ` +
          `Retrying in ${delayMs}ms with a fresh transaction...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }

      // Non-retryable error or final attempt exhausted
      break
    }
  }

  console.error(`[Hedera HCS] Error submitting message to topic ${topicId} after ${MAX_RETRIES} attempts:`, lastError)
  return 'SUBMIT_ERROR'
}

export interface MirrorNodeMessage {
  sequence_number: number
  running_hash: string
  message: string // Base64 encoded in Mirror Node API
  consensus_timestamp: string
}

/**
 * Fetches topic messages from Hedera Testnet Mirror Node REST API
 */
export async function getTopicMessages(topicId: string): Promise<string[]> {
  if (topicId.startsWith('0.0.mock')) {
    return []
  }

  try {
    const network = process.env.HEDERA_NETWORK || 'testnet'
    const mirrorUrl = `https://${network}.mirrornode.hedera.com/api/v1/topics/${topicId}/messages`
    
    const res = await fetch(mirrorUrl)
    if (!res.ok) {
      throw new Error(`Mirror node HTTP error ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()
    const messages: MirrorNodeMessage[] = data.messages || []

    // Decode Base64 message strings from mirror node
    return messages.map((m) => Buffer.from(m.message, 'base64').toString('utf-8'))
  } catch (error) {
    console.error(`[Hedera HCS] Error querying mirror node for topic ${topicId}:`, error)
    return []
  }
}
