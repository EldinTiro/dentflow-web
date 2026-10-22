import { describe, it, expect, afterEach } from 'vitest'
import { captureRequests, restoreRequests } from '@/test/captureRequests'
import { appointmentService } from './appointmentService'

describe('appointmentService.list', () => {
  afterEach(() => restoreRequests())

  // QA-008: a 00:30 appointment was missing from "Today" between 00:00 and 02:00
  it('sends the local days as their exact UTC bounds', async () => {
    const seen = captureRequests({ items: [], totalCount: 0 })

    await appointmentService.list({ dateFrom: '2026-10-22', dateTo: '2026-10-22', pageSize: 50 })

    expect(seen[0].params).toMatchObject({
      dateFrom: '2026-10-21T22:00:00.000Z',
      dateTo: '2026-10-22T21:59:59.999Z',
      pageSize: 50,
    })
  })

  it('leaves the bounds out when no dates are given', async () => {
    const seen = captureRequests({ items: [], totalCount: 0 })

    await appointmentService.list({ patientId: 'p1' })

    expect(seen[0].params.dateFrom).toBeUndefined()
    expect(seen[0].params.dateTo).toBeUndefined()
  })
})
