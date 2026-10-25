import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { invalidateAppointmentQueries } from './appointmentQueries'

describe('invalidateAppointmentQueries', () => {
  // Calendar, dashboard and free-slot views cache appointments under their own
  // keys; refreshing only ['appointments'] left them stale after a booking.
  it('marks every appointment-derived view stale and leaves unrelated data alone', async () => {
    const qc = new QueryClient()
    const affected = [
      ['appointments', { page: 1 }],
      ['appointments-week', '2026-10-19'],
      ['appointments-today', '2026-10-22'],
      ['appointments-pending', '2026-10-22'],
      ['appointments-tomorrow', '2026-10-23'],
      ['appointments-slot-check', '2026-10-22', ''],
      ['slots', 'prov-1', '2026-10-22', 30],
      ['patient-appointments', 'pat-1'],
      ['appointment-history', 'appt-1'],
      ['dashboard-stats'],
    ]
    const untouched = [['patients'], ['appointment-types'], ['staff'], ['invoices']]
    for (const key of [...affected, ...untouched]) qc.setQueryData(key, {})

    await invalidateAppointmentQueries(qc)

    for (const key of affected) expect(qc.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true)
    for (const key of untouched) expect(qc.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(false)
  })
})
