import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffService } from '../services/staffService'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useAuthStore } from '@/features/auth/store/authStore'

interface Props {
  staffId: string
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

export function StaffBlockedTimesTab({ staffId }: Props) {
  const queryClient = useQueryClient()
  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    startAt: '',
    endAt: '',
    reason: '',
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
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setShowForm(false)
      setForm({ startAt: '', endAt: '', reason: '', notes: '' })
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to add blocked time.')),
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
            Time periods when this staff member is unavailable (vacation, training, personal leave).
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
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            + Add Block
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">New blocked time</h3>
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
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Reason <span className="opacity-60">(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Vacation, Training…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                maxLength={255}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
          {/* errors shown via toast */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false) }}
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
          No blocked times {showAll ? '' : 'upcoming'}.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date range</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Reason</th>
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
                      {bt.reason ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          {bt.reason}
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

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Remove blocked time?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This blocked period will be removed.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
