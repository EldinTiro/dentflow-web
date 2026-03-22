import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  billingService,
  type InvoiceStatus,
  type InvoiceSummaryResponse,
} from '../services/billingService'
import { CreateInvoiceDrawer } from './CreateInvoiceDrawer'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Void: 'bg-red-100 text-red-500',
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  patientId: string
}

export function PatientBillingTab({ patientId }: Props) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['patient-invoices', patientId, page],
    queryFn: () => billingService.listByPatient(patientId, { page, pageSize: 20 }),
    placeholderData: (prev) => prev,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {data ? t('totalCount', { count: data.totalCount }) : ''}
        </span>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          {t('patientTab.newInvoice')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">{tc('loading')}</p>
        )}
        {!isLoading && data?.items.length === 0 && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            {t('patientTab.emptyState')}
          </p>
        )}
        {data && data.items.length > 0 && (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t('table.invoiceNumber')}</th>
                <th className="px-4 py-3 text-left">{t('table.status')}</th>
                <th className="px-4 py-3 text-left">{t('table.issuedAt')}</th>
                <th className="px-4 py-3 text-right">{t('table.subTotal')}</th>
                <th className="px-4 py-3 text-right">{t('table.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.items.map((inv: InvoiceSummaryResponse) => (
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
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}
                    >
                      {t(`status.${inv.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(inv.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {fmt(inv.subTotal)}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}

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

      {showCreate && (
        <CreateInvoiceDrawer patientId={patientId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
