import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import {
  treatmentService,
  PLAN_STATUS_COLORS,
  PLAN_STATUS_LABELS,
  ITEM_STATUS_COLORS,
  ITEM_STATUS_LABELS,
  ALL_PLAN_STATUSES,
  ALL_ITEM_STATUSES,
  type TreatmentPlanResponse,
  type TreatmentPlanItemResponse,
  type TreatmentPlanStatus,
  type TreatmentPlanItemStatus,
} from '../services/treatmentService'

// ─── Create Plan Form ────────────────────────────────────────────────────────

function CreatePlanForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
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
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">New Treatment Plan</h3>
      <input
        autoFocus
        placeholder="Plan title (e.g. Initial Treatment Plan)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!title.trim() || mutation.isPending}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating…' : 'Create Plan'}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
          Cancel
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
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Tooth #</label>
          <input
            type="number"
            min={1}
            max={32}
            placeholder="1–32"
            value={form.toothNumber}
            onChange={(e) => set('toothNumber', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Surface</label>
          <input
            placeholder="M, D, O…"
            value={form.surface}
            onChange={(e) => set('surface', e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">CDT Code</label>
          <input
            placeholder="D0150"
            value={form.cdtCode}
            onChange={(e) => set('cdtCode', e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Fee ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.fee}
            onChange={(e) => set('fee', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-0.5">Description *</label>
          <input
            autoFocus={!existing}
            placeholder="Composite restoration, 2 surfaces…"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ALL_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>{ITEM_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.description.trim() || mutation.isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check size={12} /> {mutation.isPending ? 'Saving…' : existing ? 'Save' : 'Add Item'}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
          Cancel
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
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editTitle, setEditTitle] = useState(plan.title)
  const [editNotes, setEditNotes] = useState(plan.notes ?? '')
  const [editStatus, setEditStatus] = useState<TreatmentPlanStatus>(plan.status)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()

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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Plan header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {editingPlan ? (
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TreatmentPlanStatus)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ALL_PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{PLAN_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={1}
              placeholder="Notes…"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => updatePlan.mutate()}
                disabled={!editTitle.trim() || updatePlan.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Check size={11} /> {updatePlan.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingPlan(false)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 text-sm">{plan.title}</span>
              {plan.notes && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{plan.notes}</p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                PLAN_STATUS_COLORS[plan.status]
              }`}
            >
              {PLAN_STATUS_LABELS[plan.status]}
            </span>
            <span className="text-xs text-gray-500 shrink-0 font-mono">
              ${plan.totalFee.toFixed(2)}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {plan.items.length} item{plan.items.length !== 1 ? 's' : ''}
            </span>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingPlan(true); setExpanded(true) }}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
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
        <div className="divide-y divide-gray-100">
          {plan.items.length === 0 && !addingItem && (
            <p className="px-4 py-3 text-xs text-gray-400">No items yet.</p>
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
                className="flex items-center gap-3 px-4 py-2.5 group hover:bg-gray-50"
              >
                <div className="shrink-0 w-8 text-center">
                  {item.toothNumber ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {item.toothNumber}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-gray-800">{item.description}</span>
                    {item.cdtCode && (
                      <span className="text-xs font-mono text-gray-400">{item.cdtCode}</span>
                    )}
                    {item.surface && (
                      <span className="text-xs text-gray-400">({item.surface})</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                    ITEM_STATUS_COLORS[item.status]
                  }`}
                >
                  {ITEM_STATUS_LABELS[item.status]}
                </span>
                <span className="text-sm font-mono text-gray-700 shrink-0 w-16 text-right">
                  ${item.fee.toFixed(2)}
                </span>
                {canManage && (
                  <div className="invisible group-hover:visible flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingItemId(item.id)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteItem.mutate(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
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
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus size={13} /> Add item
              </button>
              {plan.items.length > 0 && (
                <span className="text-xs text-gray-500 font-mono">
                  Total: ${plan.totalFee.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Treatment Plan?</h3>
            <p className="text-sm text-gray-500 mb-5">
              <strong>{plan.title}</strong> and all its items will be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { deletePlan.mutate(); setConfirmDelete(false) }}
                disabled={deletePlan.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancel
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
        <p className="text-sm text-gray-500">
          {plans.length} plan{plans.length !== 1 ? 's' : ''}
        </p>
        {canManage && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={14} /> New Plan
          </button>
        )}
      </div>

      {showCreate && (
        <CreatePlanForm patientId={patientId} onDone={() => setShowCreate(false)} />
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : plans.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No treatment plans yet.</p>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mx-auto"
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
