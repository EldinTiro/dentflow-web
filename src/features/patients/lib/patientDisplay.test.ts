import { describe, it, expect } from 'vitest'
import { visitDates } from './patientDisplay'

// User report 2026-11-13: the overview said "Last visit: Today", Demographics 12/10/2026.
// The stored dates are not kept up to date; the visits are. A later stored date (an imported
// paper record) still counts.
describe('visitDates', () => {
  it('takes the visits when they are later than the stored dates', () => {
    const d = visitDates({
      firstVisitDate: '2026-07-06', lastVisitDate: '2026-10-12',
      insights: { firstVisitAt: '2026-08-01T09:00:00Z', lastVisitAt: '2026-11-13T09:15:00Z' },
    })
    expect(d.last).toBe('2026-11-13T09:15:00Z')
    expect(d.first).toBe('2026-07-06')
  })

  it('keeps a later stored date, from an imported record', () => {
    const d = visitDates({
      firstVisitDate: '2019-03-01', lastVisitDate: '2026-11-01',
      insights: { firstVisitAt: '2026-05-01T09:00:00Z', lastVisitAt: '2026-05-01T09:00:00Z' },
    })
    expect(d.last).toBe('2026-11-01')
    expect(d.first).toBe('2019-03-01')
  })

  it('has nothing when there is nothing', () => {
    expect(visitDates({ firstVisitDate: null, lastVisitDate: null, insights: undefined })).toEqual({ first: null, last: null })
  })
})
