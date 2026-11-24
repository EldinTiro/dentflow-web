import { useEffect, useId, useRef, useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, Banknote, MoreHorizontal, MoreVertical, NotebookPen, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
import {
  billingService,
  type InvoiceResponse,
  type InvoiceStatus,
  type InvoiceLineItemResponse,
} from '../services/billingService'
import { patientService } from '@/features/patients/services/patientService'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { RecordPaymentModal } from '../components/RecordPaymentModal'
import { AddLineItemModal } from '../components/AddLineItemModal'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate, formatMoney } from '@/shared/lib/format'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { can, canViewFinance } from '@/shared/lib/permissions'
import { invalidateBillingQueries } from '../services/billingQueries'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300',
  Paid: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  Void: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300',
}

// Always with the currency (QA-032).
const fmt = (n: number) => formatMoney(n)

const CARD = 'rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
const FIELD = 'w-full rounded-lg border border-control bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'

/** Closes a small menu on a click elsewhere or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open, close])
  return ref
}

/**
 * The last row of the items (user request 2026-11-12): a service from the price list, or
 * anything typed, with its quantity and price, added with Enter or "+". No pop-up.
 */
function AddItemRow({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation('billing')
  const queryClient = useQueryClient()
  const listId = useId()
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [price, setPrice] = useState<number | ''>('')
  const [open, setOpen] = useState(false)
  const box = useDismiss(open, () => setOpen(false))

  const { data: services = [] } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  })
  const q = description.trim().toLowerCase()
  const matches = q ? services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8) : []

  const add = useMutation({
    mutationFn: () => billingService.addLineItem(invoiceId, {
      description: description.trim(),
      cdtCode: null,
      toothNumber: null,
      quantity: Number(quantity) || 1,
      unitFee: Number(price) || 0,
    }),
    onSuccess: () => {
      invalidateBillingQueries(queryClient)
      setDescription('')
      setQuantity(1)
      setPrice('')
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <form
      role="group"
      aria-label={t('add.group')}
      onSubmit={(e) => { e.preventDefault(); if (description.trim()) add.mutate() }}
      className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.25rem] items-center gap-2 bg-gray-50 px-4 py-2.5 dark:bg-gray-900/40"
    >
      <div ref={box} className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          role="combobox"
          aria-label={t('add.service')}
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={t('add.servicePlaceholder')}
          className={`${FIELD} pl-8`}
        />
        {open && matches.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {matches.map((s) => (
              <li
                key={s.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setDescription(s.name); if (s.defaultFee != null) setPrice(s.defaultFee); setOpen(false) }}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm text-gray-800 hover:bg-primary-50 dark:text-gray-100 dark:hover:bg-primary-900/30"
              >
                <span className="truncate">{s.name}</span>
                {s.defaultFee != null && <span className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400">{fmt(s.defaultFee)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="number"
        min={1}
        aria-label={t('add.quantity')}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
        className={`${FIELD} text-center`}
      />
      <input
        type="number"
        min={0}
        step="0.01"
        aria-label={t('add.price')}
        value={price}
        onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={t('add.price')}
        className={`${FIELD} text-right`}
      />
      <button
        type="submit"
        aria-label={t('add.submit')}
        disabled={add.isPending}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
      >
        <Plus size={16} aria-hidden />
      </button>
    </form>
  )
}

/** "⋮" on an item: edit or delete it. */
function ItemMenu({ item, onEdit, onDelete }: { item: InvoiceLineItemResponse; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const [open, setOpen] = useState(false)
  const box = useDismiss(open, () => setOpen(false))
  return (
    <div ref={box} className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('detail.itemActions', { name: item.description })}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <MoreVertical size={15} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
            <Pencil size={14} aria-hidden /> {tc('button.edit')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10">
            <Trash2 size={14} aria-hidden /> {tc('button.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

/** The invoice's note, written in place by those who may change invoices (finance.adjust). */
function NoteBlock({ invoice, canEdit }: { invoice: InvoiceResponse; canEdit: boolean }) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(invoice.notes ?? '')

  const save = useMutation({
    mutationFn: () => billingService.update(invoice.id, { dueDate: invoice.dueDate, notes: draft.trim() || null }),
    onSuccess: () => {
      invalidateBillingQueries(queryClient)
      setEditing(false)
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  if (!canEdit && !invoice.notes) return null

  return (
    <div className="flex items-start gap-2 border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-700">
      <NotebookPen size={15} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
      {editing ? (
        <div className="flex-1 space-y-2">
          <textarea
            aria-label={t('detail.note')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            className={FIELD}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setDraft(invoice.notes ?? ''); setEditing(false) }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              {tc('button.cancel')}
            </button>
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {t('detail.saveNote')}
            </button>
          </div>
        </div>
      ) : invoice.notes ? (
        <div className="flex flex-1 items-start justify-between gap-2">
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{invoice.notes}</p>
          {canEdit && (
            <button type="button" onClick={() => { setDraft(invoice.notes ?? ''); setEditing(true) }} aria-label={t('detail.editNote')}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
              <Pencil size={14} aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
          {t('detail.addNote')}
        </button>
      )}
    </div>
  )
}

/**
 * One invoice (redesign 2026-11-12): items on the left, added in place; the totals, the
 * payment button and the payments on the right; rare actions under More.
 */
export function InvoiceDetailPage() {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const { id } = useParams<{ id: string }>()
  const roles = useAuthStore(selectRoles)
  const canFinance = canViewFinance(roles)
  const canAdjust = can(roles, 'finance.adjust')
  const queryClient = useQueryClient()

  const [showPayment, setShowPayment] = useState(false)
  const [editItem, setEditItem] = useState<InvoiceLineItemResponse | null>(null)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBox = useDismiss(moreOpen, () => setMoreOpen(false))

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
      invalidateBillingQueries(queryClient)
      setConfirmVoid(false)
    },
    // Close the dialog either way; the toast explains why nothing changed (QA-036).
    onError: (err) => {
      toast.error(getApiErrorMessage(err))
      setConfirmVoid(false)
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.deleteLineItem(id!, itemId),
    onSuccess: () => {
      invalidateBillingQueries(queryClient)
      setConfirmDeleteItemId(null)
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  // The clinic-wide invoice list is finance.view; everyone else returns to the patient's bills.
  const backTo = canFinance
    ? { to: '/finance/invoices', label: t('detail.backToInvoices') }
    : { to: invoice ? `/patients/${invoice.patientId}?tab=billing` : '/patients', label: t('detail.backToPatient') }

  if (isLoading) return <div className="p-8 text-gray-500 text-sm dark:text-gray-400">{tc('loading')}</div>
  if (isError || !invoice) return (
    <div className="p-8">
      <p className="text-red-500 text-sm mb-3">Invoice not found.</p>
      <Link to={backTo.to} className="text-sm text-primary-700 dark:text-primary-300 hover:underline">
        {backTo.label}
      </Link>
    </div>
  )

  const isVoid = invoice.status === 'Void'
  const isPaid = invoice.status === 'Paid'
  // The API refuses line-item changes once an invoice is fully paid (QA-004).
  const lineItemsLocked = isVoid || isPaid
  // DT-35 / DT-03: only an invoice with no payment can be voided (the API agrees)
  const voidBlocked = invoice.paidAmount > 0

  return (
    <div className="max-w-5xl px-4 pt-6 pb-8 sm:px-6">
      <Link to={backTo.to} className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft size={14} aria-hidden /> {backTo.label.replace(/^←\s*/, '')}
      </Link>

      {/* Header, like the other pages: title, who and when, one quiet menu */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
            <span className="tabular-nums">{invoice.invoiceNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
              {t(`status.${invoice.status}`)}
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {patient && (
              <>
                <Link to={`/patients/${patient.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                  {patient.fullName}
                </Link>
                {' · '}
              </>
            )}
            {t('detail.issuedAt')} {formatDate(invoice.issuedAt)}
            {invoice.dueDate && <> · {t('detail.dueDate')} {formatDate(invoice.dueDate)}</>}
          </p>
        </div>
        {!isVoid && (
          <div ref={moreBox} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className="flex items-center gap-1.5 rounded-lg border border-control px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <MoreHorizontal size={15} aria-hidden /> {t('detail.more')}
            </button>
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  role="menuitem"
                  disabled={voidBlocked}
                  title={voidBlocked ? t('detail.voidHasPayments') : undefined}
                  onClick={() => { setMoreOpen(false); setConfirmVoid(true) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-400/10"
                >
                  <XCircle size={14} aria-hidden /> {t('button.void')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        {/* Items */}
        <div className={CARD}>
          {/* Column heads on the same grid as the rows */}
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.25rem] items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('detail.lineItems')}</h2>
            <span className="text-center text-xs text-gray-500 dark:text-gray-400">{t('lineItem.qty')}</span>
            <span className="text-right text-xs text-gray-500 dark:text-gray-400">{t('lineItem.total')}</span>
            <span />
          </div>
          {invoice.lineItems.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('detail.noLineItems')}</p>
          )}
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {invoice.lineItems.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.25rem] items-center gap-2 px-4 py-2.5 text-sm">
                <span className="truncate text-gray-900 dark:text-gray-100">{item.description}</span>
                <span className="text-center tabular-nums text-gray-500 dark:text-gray-400">{item.quantity}</span>
                <span className="text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(item.lineTotal)}</span>
                {lineItemsLocked ? <span /> : (
                  <ItemMenu item={item} onEdit={() => setEditItem(item)} onDelete={() => setConfirmDeleteItemId(item.id)} />
                )}
              </li>
            ))}
          </ul>
          {!lineItemsLocked && <AddItemRow invoiceId={invoice.id} />}
          <NoteBlock invoice={invoice} canEdit={canAdjust && !isVoid} />
        </div>

        {/* Totals and payments */}
        <section aria-label={t('detail.totals')} className={`${CARD} p-4`}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('detail.subTotal')}</dt>
              <dd className="tabular-nums text-gray-900 dark:text-gray-100">{fmt(invoice.subTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('detail.paidAmount')}</dt>
              <dd className="tabular-nums text-green-700 dark:text-green-400">{fmt(invoice.paidAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
              <dt className="font-medium text-gray-800 dark:text-gray-100">{t('detail.balanceDue')}</dt>
              <dd className={`text-2xl font-semibold tabular-nums ${invoice.balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {fmt(invoice.balanceDue)}
              </dd>
            </div>
          </dl>

          {!isVoid && !isPaid && (
            <button
              type="button"
              onClick={() => setShowPayment(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Banknote size={16} aria-hidden /> {t('button.recordPayment')}
            </button>
          )}

          <h2 className="mt-5 mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t('detail.payments')}</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('detail.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block text-gray-800 dark:text-gray-100">{formatDate(p.paidAt)} · {t(`paymentMethod.${p.method}`)}</span>
                    {(p.reference || p.notes) && (
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{[p.reference, p.notes].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-green-700 dark:text-green-400">{fmt(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showPayment && (
        <RecordPaymentModal
          invoiceId={id!}
          balanceDue={invoice.balanceDue}
          onClose={() => setShowPayment(false)}
        />
      )}

      {editItem !== null && (
        <AddLineItemModal
          invoiceId={id!}
          item={editItem}
          onClose={() => setEditItem(null)}
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
