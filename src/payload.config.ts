import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Patients } from './collections/Patients'
import { Facilities } from './collections/Facilities'
import { Doctors } from './collections/Doctors'
import { Visits } from './collections/Visits'
import { OTPLogs } from './collections/OTPLogs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Doctors.slug, // Doctors double as the Payload admin users for MVP
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Doctors,
    Patients,
    Facilities,
    Visits,
    OTPLogs,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'fallback_soga_secret_key_32_chars_min',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/soga-db',
  }),
  sharp,
})
