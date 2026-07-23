import type { CollectionAfterChangeHook } from 'payload'
import { createTopic } from '../../services/hedera'

export const autoCreateHederaTopicsHook: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation === 'create' && doc) {
    try {
      const patientId = doc.patientId || doc.id
      console.log(`[Patient Hook] Auto-creating static Hedera topics for patient: ${patientId}`)

      // Create the 3 static Hedera consensus topics
      const reportTopicId = await createTopic(`Doctor Reports - ${patientId}`)
      const orderTopicId = await createTopic(`Medical Orders - ${patientId}`)
      const prescriptionTopicId = await createTopic(`Prescriptions - ${patientId}`)

      const initialTopics = [
        { category: 'doctorReports', topicId: reportTopicId },
        { category: 'medicalOrders', topicId: orderTopicId },
        { category: 'prescriptions', topicId: prescriptionTopicId },
      ]

      // Update patient document with created topics
      await req.payload.update({
        collection: 'patients',
        id: doc.id,
        data: {
          topicsArray: initialTopics,
        },
      })

      console.log(`[Patient Hook] Successfully attached 3 static Hedera topics to patient ${patientId}`)
    } catch (err) {
      console.error(`[Patient Hook Error] Failed to create Hedera topics for patient ${doc.id}:`, err)
    }
  }

  return doc
}
