import { describe, it, expect } from 'vitest'
import { formatDate, formatMoney, formatTime, formatDayMonth } from './format'

describe('formatDate', () => {
  // QA-032: lists showed US "10/22/2026" for a BiH clinic; staff hire date showed raw ISO
  it('uses day-first formats for every UI language', () => {
    expect(formatDate('2026-10-22T08:00:00Z', 'bs')).toBe('22. 10. 2026.')
    expect(formatDate('2026-10-22T08:00:00Z', 'de')).toBe('22.10.2026')
    expect(formatDate('2026-10-22T08:00:00Z', 'en')).toBe('22/10/2026')
  })

  it('treats a plain YYYY-MM-DD as a calendar date, not UTC midnight', () => {
    expect(formatDate('2026-10-01', 'bs')).toBe('1. 10. 2026.')
  })

  it('shows a dash for nothing', () => {
    expect(formatDate(null, 'en')).toBe('—')
  })
})

describe('formatTime', () => {
  // QA-032: the slot hint read "08:00:00 – 22:30"
  it('drops seconds', () => {
    expect(formatTime('08:00:00')).toBe('08:00')
    expect(formatTime('22:30')).toBe('22:30')
  })
})

describe('formatMoney', () => {
  // QA-032: invoice amounts had no currency while the rest of the app showed KM
  it('always shows the currency', () => {
    expect(formatMoney(75, 'bs')).toBe('75,00 KM')
    expect(formatMoney(1234.5, 'en')).toBe('1,234.50 KM')
  })
})

// User report: Bosnian showed Croatian dates ("utorak, 3. studenoga 2026.", "25. lis")
describe('formatDayMonth', () => {
  const tuesday = new Date(2026, 10, 3, 10, 30)

  it('writes Bosnian month names, not Croatian ones', () => {
    expect(formatDayMonth(tuesday, { weekday: 'long', month: 'long', year: true }, 'bs')).toBe('utorak, 3. novembra 2026.')
    expect(formatDayMonth(tuesday, { month: 'short' }, 'bs')).toBe('3. nov')
    expect(formatDayMonth(new Date(2026, 9, 31, 1, 0), { weekday: 'short', month: 'short', time: true }, 'bs')).toBe('sub, 31. okt, 01:00')
  })

  it('follows the app language, not the browser', () => {
    expect(formatDayMonth(tuesday, { weekday: 'long', month: 'long', year: true }, 'en')).toMatch(/Tuesday.*3 November 2026/)
    expect(formatDayMonth(tuesday, { weekday: 'long', month: 'long', year: true }, 'de')).toMatch(/Dienstag.*3\. November 2026/)
  })
})
