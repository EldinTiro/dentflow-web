import { localDayStartUtc, localDayEndUtc, toLocalIsoDate } from '@/shared/lib/dates'
import type { FinancePayment, FinancePeriod } from '../services/financeService'

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM` of the local month containing `date`. */
export function monthOf(date: Date | string): string {
  return toLocalIsoDate(date).slice(0, 7)
}

/** `YYYY-MM` shifted by `delta` months. */
export function monthKey(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** The local calendar month as UTC instants — the API compares instants (QA-008). */
export function monthRange(month: string): FinancePeriod {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: localDayStartUtc(`${month}-01`), to: localDayEndUtc(`${month}-${pad(lastDay)}`) }
}

/** Payments summed per local month, oldest first, for the `count` months ending at `endMonth`. */
export function revenueByMonth(payments: FinancePayment[], endMonth: string, count = 12) {
  const months = Array.from({ length: count }, (_, i) => monthKey(endMonth, i - count + 1))
  const totals = new Map(months.map((m) => [m, 0]))
  for (const p of payments) {
    const m = monthOf(p.paidAt)
    if (totals.has(m)) totals.set(m, totals.get(m)! + p.amount)
  }
  return months.map((month) => ({ month, total: round2(totals.get(month)!) }))
}

/** Sum per payment method, largest first. */
export function totalsByMethod(payments: FinancePayment[]) {
  const totals = new Map<string, number>()
  for (const p of payments) totals.set(p.method, (totals.get(p.method) ?? 0) + p.amount)
  return [...totals].map(([method, amount]) => ({ method, amount: round2(amount) })).sort((a, b) => b.amount - a.amount)
}

export type AgeBucket = '0-30' | '31-60' | '60+'
export const AGE_BUCKETS: AgeBucket[] = ['0-30', '31-60', '60+']

/** How long the oldest open invoice has been waiting. */
export function ageBucket(issuedAt: string, now: Date = new Date()): AgeBucket {
  const days = daysSince(issuedAt, now)
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  return '60+'
}

export function daysSince(issuedAt: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(issuedAt).getTime()) / 86_400_000)
}

/** Whole-percent change vs the previous value; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
