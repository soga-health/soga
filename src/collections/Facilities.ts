import type { CollectionConfig } from 'payload'
import { customAlphabet } from 'nanoid'

const nanoidFac = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

export const Facilities: CollectionConfig = {
  slug: 'facilities',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['facilityId', 'name', 'type'],
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
        if (operation === 'create' && !data.facilityId) {
          data.facilityId = `FAC-${nanoidFac()}`
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'facilityId',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Hospital', value: 'Hospital' },
        { label: 'Lab', value: 'Lab' },
        { label: 'Pharmacy', value: 'Pharmacy' },
      ],
    },
  ],
}
