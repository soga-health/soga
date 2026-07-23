import type { CollectionConfig } from 'payload'

export const OTPLogs: CollectionConfig = {
  slug: 'otp-logs',
  admin: {
    useAsTitle: 'otpCode',
    defaultColumns: ['phoneNumber', 'otpCode', 'isValid', 'expiresAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'otpCode',
      type: 'text',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
    {
      name: 'isValid',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'doctorId',
      type: 'relationship',
      relationTo: 'doctors',
      required: false,
    },
    {
      name: 'patientId',
      type: 'relationship',
      relationTo: 'patients',
      required: false,
    },
  ],
}
