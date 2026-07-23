/**
 * Local test runner for the cron/reminders logic.
 *
 * Usage:
 *   npx tsx scripts/test-reminders.ts              # uses .env
 *   npx tsx scripts/test-reminders.ts --dry-run     # skips SMS, just prints what would be sent
 *   npx tsx scripts/test-reminders.ts --days 0      # look at TODAY instead of tomorrow
 *
 * Requires the dev server to NOT be running (or a separate DB), because
 * Payload opens a connection to MongoDB on boot.
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { sendSMS } from '../src/services/twilio'

// ── CLI flags ────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const daysOffsetIdx = args.indexOf('--days')
const daysOffset = daysOffsetIdx !== -1 ? Number(args[daysOffsetIdx + 1]) : 1

// ── Interfaces (mirrored from route) ────────────────────────────────
interface PatientRel {
  id: string
  phoneNumber?: string
}

interface DoctorRel {
  id: string
  name?: string
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Soga Cron Reminders — Local Test Runner')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Mode     : ${dryRun ? '🔕 DRY-RUN (no SMS sent)' : '📤 LIVE (SMS will be sent)'}`)
  console.log(`  Offset   : looking ${daysOffset} day(s) ahead`)
  console.log()

  // Boot Payload (connects to MongoDB)
  console.log('[1/3] Booting Payload…')
  const payload = await getPayload({ config })
  console.log('       ✔ Payload ready\n')

  // Build date window
  const now = new Date()
  const targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset, 0, 0, 0)
  const targetEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset, 23, 59, 59)

  console.log(`[2/3] Querying visits between ${targetStart.toISOString()} and ${targetEnd.toISOString()}…`)

  const visitsResult = await payload.find({
    collection: 'visits',
    where: {
      status: { equals: 'scheduled' },
      date: {
        greater_than_equal: targetStart.toISOString(),
        less_than_equal: targetEnd.toISOString(),
      },
    },
    depth: 2,
  })

  console.log(`       ✔ Found ${visitsResult.docs.length} scheduled visit(s)\n`)

  if (visitsResult.docs.length === 0) {
    console.log('  Nothing to send — exiting.')
    process.exit(0)
  }

  // Send reminders
  console.log('[3/3] Processing reminders…\n')

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const visit of visitsResult.docs) {
    const patientDoc = visit.patientId as unknown as PatientRel | undefined
    const doctorDoc = visit.doctorId as unknown as DoctorRel | undefined

    if (!patientDoc || !patientDoc.phoneNumber) {
      console.log(`  ⏭  Visit ${visit.id} — no patient phone number, skipping`)
      skipped++
      continue
    }

    const doctorName = doctorDoc?.name ? `Dr. ${doctorDoc.name}` : 'your doctor'
    const visitTime = new Date(visit.date).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const smsText = `Reminder from Soga Healthcare: Your appointment with ${doctorName} is scheduled for tomorrow at ${visitTime}.`

    console.log(`  📋 Visit ${visit.id}`)
    console.log(`     Patient : ${patientDoc.phoneNumber}`)
    console.log(`     Doctor  : ${doctorName}`)
    console.log(`     Time    : ${visitTime}`)
    console.log(`     SMS     : "${smsText}"`)

    if (dryRun) {
      console.log('     Result  : 🔕 skipped (dry-run)\n')
      sent++
      continue
    }

    try {
      const ok = await sendSMS(patientDoc.phoneNumber, smsText)
      if (ok) {
        console.log('     Result  : ✅ sent\n')
        sent++
      } else {
        console.log('     Result  : ❌ sendSMS returned false\n')
        failed++
      }
    } catch (err) {
      console.log(`     Result  : ❌ error — ${err}\n`)
      failed++
    }
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Summary')
  console.log(`    Visits found : ${visitsResult.docs.length}`)
  console.log(`    Sent         : ${sent}`)
  console.log(`    Skipped      : ${skipped}`)
  console.log(`    Failed       : ${failed}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
