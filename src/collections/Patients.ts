import type { CollectionConfig } from 'payload'
import { generatePatientId } from '../services/otp'
import { autoCreateHederaTopicsHook } from '../hooks/patients/afterCreate'

export const Patients: CollectionConfig = {
  slug: 'patients',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['patientId', 'name', 'phoneNumber'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && !data.patientId) {
          data.patientId = generatePatientId()
        }
        return data
      },
    ],
    afterChange: [autoCreateHederaTopicsHook],
  },
  fields: [
    {
      name: 'patientId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Unique Soga Patient ID (e.g. SOG-9A8B7C6D)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Patient phone number in international/South African format (e.g. +27821234567)',
      },
    },
    {
      name: 'topicsArray',
      type: 'array',
      admin: {
        description: 'Hedera HCS Topic IDs associated with this patient',
      },
      fields: [
        {
          name: 'category',
          type: 'text',
          required: true,
        },
        {
          name: 'topicId',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
