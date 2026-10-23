import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { formatMoney, formatDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { financeService } from '../services/financeService'
import { AGE_BUCKETS, ageBucket, daysSince } from '../lib/finance'

const CARD = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800'

/** Who owes the clinic money, oldest debt first, grouped by how long it has waited. */
export function DebtorsPage() {
  const { t } = useTranslation('finance')
  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ['finance-debtors'],
    queryFn: () => financeService.getDebtors(),
  })

  const now = new Date()
  const buckets = useMemo(() => {
    const totals = Object.fromEntries(AGE_BUCKETS.map((b) => [b, 0])) as Record<string, number>
    for (const d of debtors) totals[ageBucket(d.oldestOpenIssuedAt)] += d.balance
    return totals
  }, [debtors])
  const total = debtors.reduce((s, d) => s + d.balance, 0)

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div data-testid="debtors-total" className={`${CARD} p-5`}>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('debtors.total')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatMoney(total)}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('kpi.patients', { count: debtors.length })}</p>
        </div>
        {AGE_BUCKETS.map((b) => (
          <div key={b} data-testid={`bucket-${b}`} className={`${CARD} p-5`}>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t(`debtors.bucket.${b}`)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatMoney(buckets[b])}</p>
          </div>
        ))}
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        {!isLoading && debtors.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('debtors.empty')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3">{t('debtors.patient')}</th>
                <th scope="col" className="px-4 py-3">{t('debtors.phone')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('debtors.openInvoices')}</th>
                <th scope="col" className="px-4 py-3">{t('debtors.oldest')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('debtors.overdue')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('debtors.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {debtors.map((d) => (
                <tr key={d.patientId}>
                  <td className="px-4 py-3">
                    <Link to={`/patients/${d.patientId}?tab=billing`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">{d.patientName}</Link>
                    <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{d.patientNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    {d.phoneMobile
                      ? <a href={`tel:${d.phoneMobile}`} className="text-gray-700 hover:underline dark:text-gray-300">{d.phoneMobile}</a>
                      : <span className="text-gray-500 dark:text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{d.openInvoices}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {formatDate(d.oldestOpenIssuedAt)}
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">· {t('debtors.days', { count: daysSince(d.oldestOpenIssuedAt, now) })}</span>
                  </td>
                  <td className={cn('px-4 py-3 text-right tabular-nums', d.overdueBalance > 0 ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400')}>
                    {formatMoney(d.overdueBalance)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{formatMoney(d.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
