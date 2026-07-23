import type { CollectionConfig } from 'payload'

export const Visits: CollectionConfig = {
  slug: 'visits',
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['patientId', 'doctorId', 'date', 'status'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'patientId',
      type: 'relationship',
      relationTo: 'patients',
      required: true,
    },
    {
      name: 'doctorId',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
  ],
}
