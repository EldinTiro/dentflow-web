import { describe, it, expect } from 'vitest'
import { absenceDays, formatAbsenceDays, formatAbsenceDate } from './absence'

const local = (s: string) => new Date(s) // tests run in Europe/Sarajevo

describe('absenceDays', () => {
  // QA-024: the modal said 1.1 days for 08:00 → 17:00 and 0.6 for a half day
  it('counts a full working day as 1', () => {
    expect(absenceDays(local('2026-11-02T08:00'), local('2026-11-02T17:00'))).toBe(1)
  })

  it('counts a morning or an afternoon as half a day', () => {
    expect(absenceDays(local('2026-11-02T08:00'), local('2026-11-02T13:00'))).toBe(0.5)
    expect(absenceDays(local('2026-11-02T13:00'), local('2026-11-02T17:00'))).toBe(0.5)
  })

  it('adds up multi-day absences, including half first/last days', () => {
    expect(absenceDays(local('2026-11-02T08:00'), local('2026-11-04T17:00'))).toBe(3)
    expect(absenceDays(local('2026-11-02T13:00'), local('2026-11-04T13:00'))).toBe(2)
  })

  it('is 0 for an empty or inverted period', () => {
    expect(absenceDays(local('2026-11-02T17:00'), local('2026-11-02T08:00'))).toBe(0)
  })
})

describe('formatting', () => {
  it("writes days with each language's plural rules", () => {
    expect(formatAbsenceDays(1, 'bs')).toBe('1 dan')
    expect(formatAbsenceDays(0.5, 'bs')).toBe('0,5 dana')
    expect(formatAbsenceDays(3, 'bs')).toBe('3 dana')
    expect(formatAbsenceDays(21, 'bs')).toBe('21 dan')
    expect(formatAbsenceDays(1, 'en')).toBe('1 day')
    expect(formatAbsenceDays(0.5, 'en')).toBe('0.5 days')
    expect(formatAbsenceDays(2, 'de')).toBe('2 Tage')
  })

  // QA-024: "2026 M11 2" when the browser has no bs-BA month names
  it('formats dates without relying on locale data', () => {
    expect(formatAbsenceDate('2026-11-02T07:00:00Z', 'bs')).toBe('2. 11. 2026.')
  })
})
