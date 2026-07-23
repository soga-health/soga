import type { CollectionAfterChangeHook } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { createTopic } from '../../services/hedera'

/**
 * After a patient is created, spin up 3 Hedera HCS topics in the background
 * and attach them to the patient document.
 *
 * This runs asynchronously OUTSIDE the request lifecycle so the create API
 * returns quickly and the Payload request context doesn't go stale during
 * the potentially slow Hedera network calls.
 */
export const autoCreateHederaTopicsHook: CollectionAfterChangeHook = ({
  doc,
  operation,
}) => {
  if (operation === 'create' && doc) {
    const patientId = doc.patientId || doc.id
    const docId = doc.id as string

    // Kick off the background work — intentionally not awaited so the
    // create response returns to the client immediately.
    void createTopicsInBackground(patientId, docId)
  }

  return doc
}

async function createTopicsInBackground(patientId: string, docId: string): Promise<void> {
  try {
    console.log(`[Patient Hook] Auto-creating static Hedera topics for patient: ${patientId}`)

    // Create topics sequentially to avoid nonce/transaction-ID collisions
    // on the same Hedera operator account
    const reportTopicId = await createTopic(`Doctor Reports - ${patientId}`)
    const orderTopicId = await createTopic(`Medical Orders - ${patientId}`)
    const prescriptionTopicId = await createTopic(`Prescriptions - ${patientId}`)

    const initialTopics = [
      { category: 'doctorReports', topicId: reportTopicId },
      { category: 'medicalOrders', topicId: orderTopicId },
      { category: 'prescriptions', topicId: prescriptionTopicId },
    ]

    // Use a standalone Payload instance (not the request-scoped one) so
    // the update isn't tied to the original HTTP request lifecycle.
    const payload = await getPayload({ config })

    await payload.update({
      collection: 'patients',
      id: docId,
      data: {
        topicsArray: initialTopics,
      },
      overrideAccess: true,
    })

    console.log(`[Patient Hook] Successfully attached 3 static Hedera topics to patient ${patientId}`)
  } catch (err) {
    console.error(`[Patient Hook Error] Failed to create/attach Hedera topics for patient ${docId}:`, err)
  }
}
