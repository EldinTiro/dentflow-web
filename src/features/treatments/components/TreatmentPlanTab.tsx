import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { formatMoney } from '@/shared/lib/format'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, FileText } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  treatmentService,
  PLAN_STATUS_COLORS,
  ITEM_STATUS_COLORS,
  ALL_PLAN_STATUSES,
  ALL_ITEM_STATUSES,
  type TreatmentPlanResponse,
  type TreatmentPlanItemResponse,
  type TreatmentPlanStatus,
  type TreatmentPlanItemStatus,
} from '../services/treatmentService'
import { billingService } from '@/features/billing/services/billingService'
import { StatusBadge } from '@/shared/components/StatusBadge'

// ─── Create Plan Form ────────────────────────────────────────────────────────

function CreatePlanForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const { t: tp } = useTranslation('patients')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => treatmentService.create(patientId, { title, notes: notes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatment-plans', patientId] })
      onDone()
    },
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 dark:bg-gray-900 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tp('treatmentPlans.newPlanTitle')}</h3>
      <input
        autoFocus
        placeholder={tp('treatmentPlans.titlePlaceholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
      <textarea
        placeholder={tp('treatmentPlans.notesOptional')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!title.trim() || mutation.isPending}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {mutation.isPending ? tp('treatmentPlans.creating') : tp('treatmentPlans.createPlan')}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
          {tp('treatmentPlans.cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Add / Edit Item Form ─────────────────────────────────────────────────────

interface ItemFormState {
  toothNumber: string
  surface: string
  cdtCode: string
  description: string
  fee: string
  status: TreatmentPlanItemStatus
}

const EMPTY_ITEM: ItemFormState = {
  toothNumber: '',
  surface: '',
  cdtCode: '',
  description: '',
  fee: '0',
  status: 'Planned',
}

function ItemForm({
  planId,
  existing,
  onDone,
}: {
  planId: string
  existing?: TreatmentPlanItemResponse
  onDone: () => void
}) {
  const { t: tp } = useTranslation('patients')
  const [form, setForm] = useState<ItemFormState>(
    existing
      ? {
          toothNumber: existing.toothNumber?.toString() ?? '',
          surface: existing.surface ?? '',
          cdtCode: existing.cdtCode ?? '',
          description: existing.description,
          fee: existing.fee.toString(),
          status: existing.status,
        }
      : EMPTY_ITEM,
  )
  const qc = useQueryClient()

  const set = (k: keyof ItemFormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        toothNumber: form.toothNumber ? parseInt(form.toothNumber, 10) : null,
        surface: form.surface || null,
        cdtCode: form.cdtCode || null,
        description: form.description,
        fee: parseFloat(form.fee) || 0,
        status: form.status,
      }
      return existing
        ? treatmentService.updateItem(planId, existing.id, body)
        : treatmentService.addItem(planId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatment-plan', planId] })
      qc.invalidateQueries({ queryKey: ['treatment-plans'] })
      onDone()
    },
  })

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 dark:bg-gray-800 dark:border-gray-700">
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.tooth')}</label>
          <input
            type="number"
            min={1}
            max={32}
            placeholder="1–32"
            value={form.toothNumber}
            onChange={(e) => set('toothNumber', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.surface')}</label>
          <input
            placeholder="M, D, O…"
            value={form.surface}
            onChange={(e) => set('surface', e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.cdtCode')}</label>
          <input
            placeholder="D0150"
            value={form.cdtCode}
            onChange={(e) => set('cdtCode', e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.fee')}</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.fee}
            onChange={(e) => set('fee', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.description')}</label>
          <input
            autoFocus={!existing}
            placeholder={tp('treatmentPlans.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5 dark:text-gray-400">{tp('treatmentPlans.status')}</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {ALL_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>{tp(`treatmentPlans.itemStatus.${s}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.description.trim() || mutation.isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Check size={12} /> {mutation.isPending ? tp('treatmentPlans.saving') : existing ? tp('treatmentPlans.save') : tp('treatmentPlans.addItem')}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
          {tp('treatmentPlans.cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  canManage,
}: {
  plan: TreatmentPlanResponse
  canManage: boolean
}) {
  const { t: tp } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editTitle, setEditTitle] = useState(plan.title)
  const [editNotes, setEditNotes] = useState(plan.notes ?? '')
  const [editStatus, setEditStatus] = useState<TreatmentPlanStatus>(plan.status)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const createInvoiceMutation = useMutation({
    mutationFn: () => billingService.createFromTreatmentPlan(plan.id),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['patient-invoices'] })
      toast.success(tp('treatmentPlans.invoiceCreated'))
      navigate(`/invoices/${invoice.id}`)
    },
    onError: () => toast.error(tp('treatmentPlans.invoiceFailed')),
  })

  const updatePlan = useMutation({
    mutationFn: () =>
      treatmentService.update(plan.id, {
        title: editTitle,
        notes: editNotes || null,
        status: editStatus,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatment-plans'] })
      setEditingPlan(false)
    },
  })

  const deletePlan = useMutation({
    mutationFn: () => treatmentService.delete(plan.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treatment-plans'] }),
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => treatmentService.deleteItem(plan.id, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatment-plan', plan.id] })
      qc.invalidateQueries({ queryKey: ['treatment-plans'] })
    },
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-700">
      {/* Plan header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? tc('aria.collapse') : tc('aria.expand')}
          aria-expanded={expanded}
          className="text-gray-500 hover:text-gray-600 shrink-0 dark:text-gray-400"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {editingPlan ? (
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TreatmentPlanStatus)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {ALL_PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{tp(`treatmentPlans.planStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={1}
              placeholder={tp('treatmentPlans.notesPlaceholder')}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <button
                onClick={() => updatePlan.mutate()}
                disabled={!editTitle.trim() || updatePlan.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Check size={11} /> {updatePlan.isPending ? tp('treatmentPlans.saving') : tp('treatmentPlans.save')}
              </button>
              <button
                onClick={() => setEditingPlan(false)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                {tp('treatmentPlans.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 text-sm dark:text-gray-100">{plan.title}</span>
              {plan.notes && (
                <p className="text-xs text-gray-500 mt-0.5 truncate dark:text-gray-400">{plan.notes}</p>
              )}
            </div>
            <StatusBadge status={plan.status} colorMap={PLAN_STATUS_COLORS} labelMap={{ [plan.status]: tp(`treatmentPlans.planStatus.${plan.status}`) }} className="shrink-0" />
            <span className="text-xs text-gray-500 shrink-0 font-mono dark:text-gray-400">
              {plan.totalFee.toFixed(2)} KM
            </span>
            <span className="text-xs text-gray-500 shrink-0 dark:text-gray-400">
              {plan.items.length} item{plan.items.length !== 1 ? 's' : ''}
            </span>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingPlan(true); setExpanded(true) }}
                  aria-label={tc('aria.editPlan')}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded dark:text-gray-400"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  aria-label={tc('aria.deletePlan')}
                  className="p-1 text-gray-500 hover:text-red-500 rounded dark:text-gray-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Items */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {plan.items.length === 0 && !addingItem && (
            <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{tp('treatmentPlans.noItems')}</p>
          )}
          {plan.items.map((item) =>
            editingItemId === item.id ? (
              <div key={item.id} className="px-4 py-3">
                <ItemForm
                  planId={plan.id}
                  existing={item}
                  onDone={() => setEditingItemId(null)}
                />
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 group hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="shrink-0 w-8 text-center">
                  {item.toothNumber ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-gray-700/60 dark:text-gray-300">
                      {item.toothNumber}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs dark:text-gray-400">—</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-gray-800 dark:text-gray-200">{item.description}</span>
                    {item.cdtCode && (
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{item.cdtCode}</span>
                    )}
                    {item.surface && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({item.surface})</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={item.status} colorMap={ITEM_STATUS_COLORS} labelMap={{ [item.status]: tp(`treatmentPlans.itemStatus.${item.status}`) }} className="shrink-0" />
                <span className="text-sm font-mono text-gray-700 shrink-0 w-20 text-right dark:text-gray-300">
                  {item.fee.toFixed(2)} KM
                </span>
                {canManage && (
                  <div className="invisible group-hover:visible flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingItemId(item.id)}
                      aria-label={tc('aria.editItem')}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded dark:text-gray-400"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteItem.mutate(item.id)}
                      aria-label={tc('aria.deleteItem')}
                      className="p-1 text-gray-500 hover:text-red-500 rounded dark:text-gray-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}

          {/* Add item form */}
          {addingItem && (
            <div className="px-4 py-3">
              <ItemForm planId={plan.id} onDone={() => setAddingItem(false)} />
            </div>
          )}

          {/* Footer */}
          {canManage && !addingItem && (
            <div className="px-4 py-2 flex items-center justify-between">
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium dark:text-primary-400"
              >
                <Plus size={13} /> {tp('treatmentPlans.addItem')}
              </button>
              <div className="flex items-center gap-3">
                {plan.items.length > 0 && (
                  <span className="text-xs text-gray-500 font-mono dark:text-gray-400">
                    {tp('treatmentPlans.total', { amount: formatMoney(plan.totalFee) })}
                  </span>
                )}
                {plan.items.length > 0 && (
                  <button
                    onClick={() => createInvoiceMutation.mutate()}
                    disabled={createInvoiceMutation.isPending}
                    className="flex items-center gap-1 text-xs bg-primary-600 text-white px-2.5 py-1 rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
                  >
                    <FileText size={11} />
                    {createInvoiceMutation.isPending ? tp('treatmentPlans.creating') : tp('treatmentPlans.createInvoice')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 mb-2 dark:text-gray-100">{tp('treatmentPlans.deleteTitle')}</h3>
            <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">
              <Trans t={tp} i18nKey="treatmentPlans.deleteBody" values={{ title: plan.title }} components={{ strong: <strong /> }} />
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { deletePlan.mutate(); setConfirmDelete(false) }}
                disabled={deletePlan.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {tp('treatmentPlans.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
              >
                {tp('treatmentPlans.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function TreatmentPlanTab({
  patientId,
  canManage,
}: {
  patientId: string
  canManage: boolean
}) {
  const { t: tp } = useTranslation('patients')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['treatment-plans', patientId],
    queryFn: () => treatmentService.list(patientId, { pageSize: 50 }),
    enabled: !!patientId,
  })

  const plans = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tp('treatmentPlans.count', { count: plans.length })}
        </p>
        {canManage && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={14} /> {tp('treatmentPlans.newPlan')}
          </button>
        )}
      </div>

      {showCreate && (
        <CreatePlanForm patientId={patientId} onDone={() => setShowCreate(false)} />
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{tp('treatmentPlans.loading')}</div>
      ) : plans.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center dark:bg-gray-900 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{tp('treatmentPlans.none')}</p>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 mx-auto"
            >
              <Plus size={14} /> Create First Plan
            </button>
          )}
        </div>
      ) : (
        plans.map((plan) => <PlanCard key={plan.id} plan={plan} canManage={canManage} />)
      )}
    </div>
  )
}
