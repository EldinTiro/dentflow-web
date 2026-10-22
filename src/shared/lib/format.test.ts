import { describe, it, expect } from 'vitest'
import { formatDate, formatMoney, formatTime } from './format'

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
