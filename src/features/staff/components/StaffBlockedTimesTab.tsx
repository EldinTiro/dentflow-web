import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { staffService } from '../services/staffService'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useAuthStore } from '@/features/auth/store/authStore'

interface Props {
  staffId: string
}

const ABSENCE_TYPES = [
  { value: 'Vacation', label: 'Vacation' },
  { value: 'Sickness', label: 'Sickness' },
  { value: 'SpecialLeave', label: 'Special Leave' },
  { value: 'ReligiousHoliday', label: 'Religious Holiday' },
  { value: 'PublicHoliday', label: 'Public Holiday' },
] as const

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  Vacation: 'Vacation',
  Sickness: 'Sickness',
  SpecialLeave: 'Special Leave',
  ReligiousHoliday: 'Religious Holiday',
  PublicHoliday: 'Public Holiday',
}

function formatDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const startDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return startDate === endDate ? startDate : `${startDate} – ${endDate}`
}

function formatTime(dt: string): string {
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function todayLocalDatetime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function StaffBlockedTimesTab({ staffId }: Props) {
  const queryClient = useQueryClient()
  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    startAt: '',
    endAt: '',
    absenceType: 'Vacation',
    notes: '',
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { data: blockedTimes = [], isLoading } = useQuery({
    queryKey: ['staff-blocked-times', staffId, showAll],
    queryFn: () =>
      staffService.listBlockedTimes(staffId, showAll ? undefined : { from: today }),
  })

  const addMutation = useMutation({
    mutationFn: () => {
      if (!form.startAt || !form.endAt) throw new Error('Date range required.')
      if (new Date(form.startAt) >= new Date(form.endAt)) throw new Error('End must be after start.')
      return staffService.addBlockedTime(staffId, {
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        absenceType: form.absenceType,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setShowForm(false)
      setForm({ startAt: '', endAt: '', absenceType: 'Vacation', notes: '' })
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to add absence.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (blockedTimeId: string) =>
      staffService.deleteBlockedTime(staffId, blockedTimeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setDeletingId(null)
    },
  })

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-400">Loading blocked times…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Time periods when this staff member is absent (vacation, sickness, leave).
          </p>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Show past
          </label>
        </div>
        {canManage && !showForm && (
          <button
            onClick={() => {
              const now = todayLocalDatetime()
              setForm({ startAt: now, endAt: now, absenceType: 'Vacation', notes: '' })
              setShowForm(true)
            }}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            + Add Absence
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">New absence</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date &amp; time</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date &amp; time</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={form.absenceType}
                onChange={(e) => setForm((f) => ({ ...f, absenceType: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ABSENCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes <span className="opacity-60">(optional)</span></label>
              <input
                type="text"
                placeholder="Additional details…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                maxLength={1000}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {blockedTimes.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">
          No absences {showAll ? '' : 'upcoming'}.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date range</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Notes</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {blockedTimes.map((bt) => {
                const isPast = new Date(bt.endAt) < new Date()
                return (
                  <tr key={bt.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isPast ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {formatDateRange(bt.startAt, bt.endAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatTime(bt.startAt)} – {formatTime(bt.endAt)}
                    </td>
                    <td className="px-4 py-3">
                      {bt.absenceType ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          {ABSENCE_TYPE_LABELS[bt.absenceType] ?? bt.absenceType}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {bt.notes ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeletingId(bt.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Remove absence?"
        description="This absence record will be removed."
        confirmLabel="Remove"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingId!)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
