import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

interface Props {
  months: { month: string; total: number }[]
  /** The month the page is showing — drawn in the accent, the rest recede. */
  selected: string
  monthLabel: (month: string) => string
}

/** Rounds up to 1, 2 or 5 × 10ⁿ so the top gridline is a clean number. */
function niceCeil(n: number): number {
  if (n <= 0) return 100
  const pow = 10 ** Math.floor(Math.log10(n))
  return [1, 2, 5, 10].map((s) => s * pow).find((v) => v >= n)!
}

function compact(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n)
}

/**
 * Single-series column chart: collected per month. One hue, no legend (the title
 * names the series), the selected month emphasised and directly labelled, the rest
 * on hover. Screen readers get the same numbers as a table.
 */
export function RevenueChart({ months, selected, monthLabel }: Props) {
  const { t } = useTranslation('finance')
  const max = niceCeil(Math.max(...months.map((m) => m.total)))

  return (
    <div>
      <div aria-hidden="true" className="relative flex h-48 gap-1 pl-10">
        {/* Recessive hairline gridlines: top, middle, baseline */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="pointer-events-none absolute left-10 right-0 flex items-center" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-10 w-9 -translate-y-1/2 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
              {compact(max * f)}
            </span>
            <div className="h-px w-full bg-gray-100 dark:bg-gray-700/60" />
          </div>
        ))}
        {months.map((m) => {
          const isSelected = m.month === selected
          const height = (m.total / max) * 100
          return (
            <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center">
              {isSelected && m.total > 0 && (
                <span
                  className="absolute whitespace-nowrap text-[11px] font-semibold tabular-nums text-gray-900 dark:text-gray-100"
                  style={{ bottom: `calc(${height}% + 4px)` }}
                >
                  {formatMoney(m.total)}
                </span>
              )}
              <div
                className={cn(
                  'w-full max-w-6 rounded-t transition-colors',
                  isSelected ? 'bg-primary-600 dark:bg-primary-400' : 'bg-gray-300 group-hover:bg-gray-400 dark:bg-gray-600 dark:group-hover:bg-gray-500',
                )}
                style={{ height: `${Math.max(height, m.total > 0 ? 1 : 0)}%` }}
              />
              {/* Hover tooltip, larger than the mark's own hit area */}
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block dark:bg-gray-100 dark:text-gray-900">
                {monthLabel(m.month)} · <span className="tabular-nums">{formatMoney(m.total)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-1 pl-10">
        {months.map((m) => (
          <div
            key={m.month}
            className={cn(
              'flex-1 text-center text-[11px]',
              m.month === selected ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
            )}
          >
            {monthLabel(m.month).split(' ')[0]}
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>{t('chart.tableCaption')}</caption>
        <thead>
          <tr><th scope="col">{t('chart.month')}</th><th scope="col">{t('chart.amount')}</th></tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}><th scope="row">{monthLabel(m.month)}</th><td>{formatMoney(m.total)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
