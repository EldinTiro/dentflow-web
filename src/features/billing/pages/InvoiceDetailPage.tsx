import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  billingService,
  type InvoiceStatus,
  type InvoiceLineItemResponse,
} from '../services/billingService'
import { patientService } from '@/features/patients/services/patientService'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import { AddLineItemModal } from '../components/AddLineItemModal'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Void: 'bg-red-100 text-red-500',
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function InvoiceDetailPage() {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [showPayment, setShowPayment] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem] = useState<InvoiceLineItemResponse | null>(null)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null)

  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => billingService.getById(id!),
    enabled: !!id,
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', invoice?.patientId],
    queryFn: () => patientService.getById(invoice!.patientId.toString()),
    enabled: !!invoice?.patientId,
  })

  const voidMutation = useMutation({
    mutationFn: () => billingService.voidInvoice(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] })
      setConfirmVoid(false)
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.deleteLineItem(id!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setConfirmDeleteItemId(null)
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">{tc('loading')}</div>
  if (isError || !invoice) return (
    <div className="p-8">
      <p className="text-red-500 text-sm mb-3">Invoice not found.</p>
      <Link to="/invoices" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        {t('detail.backToInvoices')}
      </Link>
    </div>
  )

  const isVoid = invoice.status === 'Void'
  const isPaid = invoice.status === 'Paid'

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/invoices" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 block">
        {t('detail.backToInvoices')}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
            >
              {t(`status.${invoice.status}`)}
            </span>
          </div>
          {patient && (
            <Link
              to={`/patients/${patient.id}`}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
            >
              {patient.fullName}
            </Link>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('detail.issuedAt')} {new Date(invoice.issuedAt).toLocaleDateString()}
            {invoice.dueDate && (
              <> · {t('detail.dueDate')} {new Date(invoice.dueDate).toLocaleDateString()}</>
            )}
          </p>
        </div>
        {!isVoid && (
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowPayment(true)}
              disabled={isPaid}
              className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('button.recordPayment')}
            </button>
            <button
              onClick={() => setShowAddItem(true)}
              className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              {t('button.addLineItem')}
            </button>
            <button
              onClick={() => setConfirmVoid(true)}
              className="border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              {t('button.void')}
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
            {t('detail.subTotal')}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 tabular-nums">
            {fmt(invoice.subTotal)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
            {t('detail.paidAmount')}
          </p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400 mt-1 tabular-nums">
            {fmt(invoice.paidAmount)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
            {t('detail.balanceDue')}
          </p>
          <p
            className={`text-2xl font-semibold mt-1 tabular-nums ${
              invoice.balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            }`}
          >
            {fmt(invoice.balanceDue)}
          </p>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            {t('detail.notes')}
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">{invoice.notes}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('detail.lineItems')}
          </h2>
        </div>
        {invoice.lineItems.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">{t('detail.noLineItems')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">{t('lineItem.description')}</th>
                <th className="px-4 py-2 text-center">{t('lineItem.qty')}</th>
                <th className="px-4 py-2 text-right">{t('lineItem.unitFee')}</th>
                <th className="px-4 py-2 text-right">{t('lineItem.total')}</th>
                {!isVoid && <th className="px-4 py-2 text-center">{t('lineItem.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{item.description}</td>
                  <td className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {fmt(item.unitFee)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                    {fmt(item.lineTotal)}
                  </td>
                  {!isVoid && (
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => setEditItem(item)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {tc('button.edit')}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteItemId(item.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          {tc('button.delete')}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('detail.payments')}
          </h2>
        </div>
        {invoice.payments.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">{t('detail.noPayments')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">{t('payment.paidAt')}</th>
                <th className="px-4 py-2 text-left">{t('payment.method')}</th>
                <th className="px-4 py-2 text-right">{t('payment.amount')}</th>
                <th className="px-4 py-2 text-left">{t('payment.reference')}</th>
                <th className="px-4 py-2 text-left">{t('payment.notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoice.payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                    {new Date(p.paidAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                    {t(`paymentMethod.${p.method}`)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-green-600 dark:text-green-400">
                    {fmt(p.amount)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {p.reference ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPayment && (
        <RecordPaymentModal
          invoiceId={id!}
          balanceDue={invoice.balanceDue}
          onClose={() => setShowPayment(false)}
        />
      )}

      {(showAddItem || editItem !== null) && (
        <AddLineItemModal
          invoiceId={id!}
          item={editItem ?? undefined}
          onClose={() => {
            setShowAddItem(false)
            setEditItem(null)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmVoid}
        title={t('confirm.voidTitle')}
        description={t('confirm.voidDescription', { number: invoice.invoiceNumber })}
        confirmLabel={t('button.void')}
        isPending={voidMutation.isPending}
        onConfirm={() => voidMutation.mutate()}
        onCancel={() => setConfirmVoid(false)}
      />

      <ConfirmDialog
        open={!!confirmDeleteItemId}
        title={t('confirm.deleteLineItemTitle')}
        description={t('confirm.deleteLineItemDescription')}
        confirmLabel={tc('button.delete')}
        isPending={deleteItemMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteItemId) deleteItemMutation.mutate(confirmDeleteItemId)
        }}
        onCancel={() => setConfirmDeleteItemId(null)}
      />
    </div>
  )
}
