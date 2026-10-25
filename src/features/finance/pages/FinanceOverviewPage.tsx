import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatMoney } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { financeService } from '../services/financeService'
import { monthOf, monthKey, monthRange, revenueByMonth, totalsByMethod, percentChange } from '../lib/finance'
import { RevenueChart } from '../components/RevenueChart'

const CARD = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  // Direction carries an icon and a sign, so it never relies on color alone.
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-1 text-xs font-medium',
        value > 0 ? 'text-green-700 dark:text-green-300' : value < 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400',
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {value > 0 ? '+' : ''}{value}% <span className="font-normal text-gray-500 dark:text-gray-400">{label}</span>
    </p>
  )
}

function Kpi({ id, label, value, children }: { id: string; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div data-testid={id} className={CARD}>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      {children}
    </div>
  )
}

export function FinanceOverviewPage() {
  const { t } = useTranslation('finance')
  const { t: tb } = useTranslation('billing')
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? monthOf(new Date())
  const prevMonth = monthKey(month, -1)
  const monthNames = t('months', { returnObjects: true }) as string[]
  const monthLabel = (m: string) => `${monthNames[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`

  // Twelve months of payments feed the chart, this month's and last month's totals, and the method mix.
  const chartPeriod = { from: monthRange(monthKey(month, -11)).from, to: monthRange(month).to }
  const { data: payments = [] } = useQuery({
    queryKey: ['finance-payments', chartPeriod],
    queryFn: () => financeService.getPayments(chartPeriod),
  })
  const { data: summary } = useQuery({
    queryKey: ['finance-summary', month],
    queryFn: () => financeService.getSummary(monthRange(month)),
  })
  const { data: prevSummary } = useQuery({
    queryKey: ['finance-summary', prevMonth],
    queryFn: () => financeService.getSummary(monthRange(prevMonth)),
  })

  const series = useMemo(() => revenueByMonth(payments, month, 12), [payments, month])
  const collected = series[series.length - 1]?.total ?? 0
  const prevCollected = series[series.length - 2]?.total ?? 0
  const methods = useMemo(() => totalsByMethod(payments.filter((p) => monthOf(p.paidAt) === month)), [payments, month])
  const methodTotal = methods.reduce((s, m) => s + m.amount, 0)

  const vs = t('kpi.vsPrevious', { month: monthLabel(prevMonth) })
  const noCompare = t('kpi.noComparison', { month: monthLabel(prevMonth) })
  const goTo = (m: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('month', m); return n }, { replace: true })

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goTo(prevMonth)} aria-label={t('period.previousMonth')}
          className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <ChevronLeft size={16} />
        </button>
        <h2 className="min-w-32 text-center text-lg font-semibold text-gray-900 dark:text-white">{monthLabel(month)}</h2>
        <button type="button" onClick={() => goTo(monthKey(month, 1))} aria-label={t('period.nextMonth')}
          className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi id="kpi-collected" label={t('kpi.collected')} value={formatMoney(collected)}>
          <Delta value={percentChange(collected, prevCollected)} label={percentChange(collected, prevCollected) === null ? noCompare : vs} />
        </Kpi>
        <Kpi id="kpi-invoiced" label={t('kpi.invoiced')} value={formatMoney(summary?.invoiced ?? 0)}>
          {summary && prevSummary && (
            <Delta value={percentChange(summary.invoiced, prevSummary.invoiced)}
              label={percentChange(summary.invoiced, prevSummary.invoiced) === null ? noCompare : vs} />
          )}
        </Kpi>
        <Kpi id="kpi-outstanding" label={t('kpi.outstanding')} value={formatMoney(summary?.outstanding ?? 0)}>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('kpi.now')} · {t('kpi.patients', { count: summary?.outstandingPatients ?? 0 })}
          </p>
        </Kpi>
        <Kpi id="kpi-overdue" label={t('kpi.overdue')} value={formatMoney(summary?.overdue ?? 0)}>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('kpi.patients', { count: summary?.overduePatients ?? 0 })}</p>
        </Kpi>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={cn(CARD, 'lg:col-span-2')} aria-labelledby="revenue-title">
          <h3 id="revenue-title" className="text-sm font-semibold text-gray-900 dark:text-white">{t('chart.revenueTitle')}</h3>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">{t('chart.revenueSubtitle')}</p>
          <RevenueChart months={series} selected={month} monthLabel={monthLabel} />
        </section>

        <section className={CARD} aria-labelledby="methods-title">
          <h3 id="methods-title" className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{t('methods.title')}</h3>
          {methods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('methods.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {methods.map((m) => {
                const share = methodTotal ? Math.round((m.amount / methodTotal) * 100) : 0
                return (
                  <li key={m.method}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-200">{tb(`paymentMethod.${m.method}`, m.method)}</span>
                      <span className="tabular-nums text-gray-900 dark:text-white">
                        {formatMoney(m.amount)} <span className="text-xs text-gray-500 dark:text-gray-400">· {share}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                      <div className="h-2 rounded bg-primary-600 dark:bg-primary-400" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
