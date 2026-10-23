import { describe, it, expect } from 'vitest'
import { monthRange, monthKey, revenueByMonth, totalsByMethod, ageBucket, percentChange } from './finance'
import type { FinancePayment } from '../services/financeService'

const pay = (paidAt: string, amount: number, method = 'Cash'): FinancePayment => ({
  invoiceId: 'i', invoiceNumber: 'INV-1', patientId: 'p', patientName: 'P', amount, method, paidAt, reference: null,
})

// Tests run in Europe/Sarajevo (vitest.config): CEST is UTC+2 in October
describe('monthRange', () => {
  it('spans the local month as UTC instants', () => {
    expect(monthRange('2026-10')).toEqual({
      from: new Date('2026-10-01T00:00:00').toISOString(),
      to: new Date('2026-10-31T23:59:59.999').toISOString(),
    })
  })
})

describe('monthKey', () => {
  it('moves across years', () => {
    expect(monthKey('2026-01', -1)).toBe('2025-12')
    expect(monthKey('2026-11', 2)).toBe('2027-01')
  })
})

describe('revenueByMonth', () => {
  // 00:30 on 1 October in Sarajevo is still 30 September in UTC (QA-008)
  it('buckets payments by the local month they were taken in', () => {
    const months = revenueByMonth([pay('2026-09-30T22:30:00Z', 50), pay('2026-09-15T10:00:00Z', 20)], '2026-10', 3)

    expect(months).toEqual([
      { month: '2026-08', total: 0 },
      { month: '2026-09', total: 20 },
      { month: '2026-10', total: 50 },
    ])
  })
})

describe('totalsByMethod', () => {
  it('sums each method, largest first', () => {
    expect(totalsByMethod([pay('2026-10-01T08:00:00Z', 30, 'Card'), pay('2026-10-01T09:00:00Z', 100), pay('2026-10-01T10:00:00Z', 5, 'Card')]))
      .toEqual([{ method: 'Cash', amount: 100 }, { method: 'Card', amount: 35 }])
  })
})

describe('ageBucket', () => {
  const now = new Date('2026-10-22T12:00:00Z')
  it.each([
    ['2026-10-01T12:00:00Z', '0-30'],
    ['2026-09-22T12:00:00Z', '0-30'],
    ['2026-09-21T12:00:00Z', '31-60'],
    ['2026-08-23T12:00:00Z', '31-60'],
    ['2026-08-01T12:00:00Z', '60+'],
  ])('%s → %s', (issuedAt, bucket) => {
    expect(ageBucket(issuedAt, now)).toBe(bucket)
  })
})

describe('percentChange', () => {
  it('is relative to the previous value', () => expect(percentChange(120, 100)).toBe(20))
  it('is null when there is nothing to compare with', () => expect(percentChange(50, 0)).toBeNull())
})
