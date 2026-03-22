import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  billingService,
  type InvoiceStatus,
  type InvoiceSummaryResponse,
} from '../services/billingService'
import { CreateInvoiceDrawer } from '../components/CreateInvoiceDrawer'

const STATUS_KEYS: { value: InvoiceStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'filter.allStatuses' },
  { value: 'Draft', labelKey: 'status.Draft' },
  { value: 'Sent', labelKey: 'status.Sent' },
  { value: 'PartiallyPaid', labelKey: 'status.PartiallyPaid' },
  { value: 'Paid', labelKey: 'status.Paid' },
  { value: 'Void', labelKey: 'status.Void' },
]

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Void: 'bg-red-100 text-red-500',
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation('billing')
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  )
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function InvoicesPage() {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const [status, setStatus] = useState<InvoiceStatus | ''>('')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', status, from, to, page],
    queryFn: () =>
      billingService.list({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          {data && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t('totalCount', { count: data.totalCount })}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {t('button.newInvoice')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InvoiceStatus | '')
            setPage(1)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_KEYS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('table.invoiceNumber')}</th>
              <th className="px-4 py-3 text-left">{t('table.status')}</th>
              <th className="px-4 py-3 text-left">{t('table.issuedAt')}</th>
              <th className="px-4 py-3 text-left">{t('table.dueDate')}</th>
              <th className="px-4 py-3 text-right">{t('table.subTotal')}</th>
              <th className="px-4 py-3 text-right">{t('table.paid')}</th>
              <th className="px-4 py-3 text-right">{t('table.balance')}</th>
              <th className="px-4 py-3 text-center">{t('table.items')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {t('emptyState')}
                </td>
              </tr>
            )}
            {data?.items.map((inv: InvoiceSummaryResponse) => (
              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    to={`/invoices/${inv.id}`}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(inv.issuedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt(inv.subTotal)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                  {fmt(inv.paidAmount)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-medium ${
                    inv.balanceDue > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {fmt(inv.balanceDue)}
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                  {inv.lineItemCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {tc('pagination.pageOfTotal', {
                page: data.page,
                totalPages: data.totalPages,
                totalCount: data.totalCount,
              })}
            </span>
            <div className="flex gap-2">
              <button
                disabled={!data.hasPreviousPage}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.prev')}
              </button>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateInvoiceDrawer onClose={() => setShowCreate(false)} />}
    </div>
  )
}
