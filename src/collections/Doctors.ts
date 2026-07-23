import type { CollectionConfig } from 'payload'
import { customAlphabet } from 'nanoid'

const nanoidDoc = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  auth: true, // Enables Payload CMS admin login & authentication
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['doctorId', 'name', 'email', 'specialty'],
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
        if (operation === 'create' && !data.doctorId) {
          data.doctorId = `DOC-${nanoidDoc()}`
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'doctorId',
      type: 'text',
      required: false,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'facilityId',
      type: 'relationship',
      relationTo: 'facilities',
      required: false,
    },
    {
      name: 'specialty',
      type: 'text',
      required: false,
    },
  ],
}
