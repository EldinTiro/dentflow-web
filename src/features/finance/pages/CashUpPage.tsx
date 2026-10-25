import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { formatMoney } from '@/shared/lib/format'
import { localDayStartUtc, localDayEndUtc, todayLocal } from '@/shared/lib/dates'
import { financeService } from '../services/financeService'
import { totalsByMethod } from '../lib/finance'

const CARD = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800'
const pad = (n: number) => String(n).padStart(2, '0')

function shiftDay(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Closing the till: every payment taken on one local day, totalled per method. */
export function CashUpPage() {
  const { t } = useTranslation('finance')
  const { t: tb } = useTranslation('billing')
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? todayLocal()
  const setDate = (d: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('date', d); return n }, { replace: true })

  const period = { from: localDayStartUtc(date), to: localDayEndUtc(date) }
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['finance-payments', period],
    queryFn: () => financeService.getPayments(period),
  })
  const methods = useMemo(() => totalsByMethod(payments), [payments])
  const total = payments.reduce((s, p) => s + p.amount, 0)

  const navBtn = 'rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={navBtn} onClick={() => setDate(shiftDay(date, -1))} aria-label={t('period.previousDay')}>
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          aria-label={t('period.date')}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button type="button" className={navBtn} onClick={() => setDate(shiftDay(date, 1))} aria-label={t('period.nextDay')}>
          <ChevronRight size={16} />
        </button>
        {date !== todayLocal() && (
          <button type="button" onClick={() => setDate(todayLocal())}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            {t('period.today')}
          </button>
        )}
        <button type="button" onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
          <Printer size={14} aria-hidden="true" /> {t('cashUp.print')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div data-testid="day-total" className={`${CARD} p-5`}>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('cashUp.total')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatMoney(total)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('cashUp.payments', { count: payments.length })}</p>
        </div>
        {methods.map((m) => (
          <div key={m.method} data-testid={`method-${m.method}`} className={`${CARD} p-5`}>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{tb(`paymentMethod.${m.method}`, m.method)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatMoney(m.amount)}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        {!isLoading && payments.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('cashUp.empty')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3">{t('cashUp.time')}</th>
                <th scope="col" className="px-4 py-3">{t('cashUp.patient')}</th>
                <th scope="col" className="px-4 py-3">{t('cashUp.invoice')}</th>
                <th scope="col" className="px-4 py-3">{t('cashUp.method')}</th>
                <th scope="col" className="px-4 py-3">{t('cashUp.reference')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('cashUp.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {payments.map((p, i) => {
                const at = new Date(p.paidAt)
                return (
                  <tr key={`${p.invoiceId}-${i}`}>
                    <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{pad(at.getHours())}:{pad(at.getMinutes())}</td>
                    <td className="px-4 py-3">
                      <Link to={`/patients/${p.patientId}?tab=billing`} className="text-gray-900 hover:underline dark:text-gray-100">{p.patientName}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${p.invoiceId}`} className="font-mono text-xs text-primary-700 hover:underline dark:text-primary-300">{p.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{tb(`paymentMethod.${p.method}`, p.method)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">{formatMoney(p.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
