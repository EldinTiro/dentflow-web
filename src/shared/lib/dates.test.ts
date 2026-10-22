import { describe, it, expect } from 'vitest'
import { todayLocal, toLocalIsoDate, localDateToInstant, localDayStartUtc, localDayEndUtc } from './dates'

// 22 Oct 2026, 01:11 in Sarajevo (CEST, UTC+2) = 21 Oct 23:11 UTC
const justAfterMidnight = new Date('2026-10-21T23:11:00Z')

describe('dates', () => {
  it('runs in the clinic time zone', () => {
    expect(new Date('2026-10-21T23:11:00Z').getTimezoneOffset()).toBe(-120)
  })

  // QA-008: toISOString().slice(0,10) gave yesterday between 00:00 and 02:00
  it('todayLocal is the local calendar date, not the UTC one', () => {
    expect(todayLocal(justAfterMidnight)).toBe('2026-10-22')
  })

  it('toLocalIsoDate formats a timestamp as its local calendar date', () => {
    expect(toLocalIsoDate('2026-10-21T23:05:00Z')).toBe('2026-10-22')
  })

  // QA-009: "today" was sent as local noon — still in the future at 01:11
  it('localDateToInstant uses the current instant when the date is today', () => {
    expect(localDateToInstant('2026-10-22', justAfterMidnight)).toBe('2026-10-21T23:11:00.000Z')
  })

  it('localDateToInstant uses local noon for any other day', () => {
    expect(localDateToInstant('2026-10-20', justAfterMidnight)).toBe('2026-10-20T10:00:00.000Z')
  })

  it('localDayStartUtc / localDayEndUtc bound the local day in UTC', () => {
    expect(localDayStartUtc('2026-10-22')).toBe('2026-10-21T22:00:00.000Z')
    expect(localDayEndUtc('2026-10-22')).toBe('2026-10-22T21:59:59.999Z')
  })
})
