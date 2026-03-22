import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  staffService,
  DAYS_OF_WEEK,
  DAY_OF_WEEK_VALUE,
  type DayOfWeek,
  type StaffAvailabilityResponse,
} from '../services/staffService'
import { useAuthStore } from '@/features/auth/store/authStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'

interface Props {
  staffId: string
}

function formatTime(t: string): string {
  // "HH:mm:ss" → "HH:mm"
  return t.substring(0, 5)
}

export function StaffAvailabilityTab({ staffId }: Props) {
  const queryClient = useQueryClient()
  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const [addingDay, setAddingDay] = useState<DayOfWeek | null>(null)
  const [form, setForm] = useState({
    startTime: '09:00',
    endTime: '17:00',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['staff-availability', staffId],
    queryFn: () => staffService.getAvailability(staffId),
  })

  const addMutation = useMutation({
    mutationFn: (day: DayOfWeek) =>
      staffService.setAvailability(staffId, {
        dayOfWeek: DAY_OF_WEEK_VALUE[day],
        startTime: form.startTime + ':00',
        endTime: form.endTime + ':00',
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability', staffId] })
      setAddingDay(null)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to save availability slot. It may overlap an existing slot.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (availabilityId: string) =>
      staffService.deleteAvailability(staffId, availabilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability', staffId] })
      setDeletingId(null)
    },
  })

  // Group slots by day for display
  const slotsByDay: Record<number, StaffAvailabilityResponse[]> = {}
  for (const slot of slots) {
    if (!slotsByDay[slot.dayOfWeek]) slotsByDay[slot.dayOfWeek] = []
    slotsByDay[slot.dayOfWeek].push(slot)
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-400">Loading availability…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Weekly recurring availability schedule. Each slot defines working hours on a given day.
        </p>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {DAYS_OF_WEEK.map((day) => {
          const dayValue = DAY_OF_WEEK_VALUE[day]
          const daySlots = slotsByDay[dayValue] ?? []
          const isAdding = addingDay === day

          return (
            <div key={day} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28">{day}</span>

                <div className="flex flex-wrap gap-2 flex-1">
                  {daySlots.length === 0 ? (
                    <span className="text-sm text-gray-400 italic">No hours set</span>
                  ) : (
                    daySlots.map((slot) => (
                      <span
                        key={slot.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
                      >
                        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                        {canManage && (
                          <button
                            onClick={() => setDeletingId(slot.id)}
                            className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors"
                            aria-label="Remove slot"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {canManage && !isAdding && (
                  <button
                    onClick={() => { setAddingDay(day) }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium ml-3 whitespace-nowrap"
                  >
                    + Add
                  </button>
                )}
              </div>

              {/* Inline add form */}
              {isAdding && (
                <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start time</label>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End time</label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Effective from</label>
                      <input
                        type="date"
                        value={form.effectiveFrom}
                        onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Effective to <span className="font-normal opacity-60">(optional)</span></label>
                      <input
                        type="date"
                        value={form.effectiveTo}
                        onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  {/* errors shown via toast */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setAddingDay(null) }}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate(day)}
                      className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {addMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!deletingId}
        title="Remove availability slot?"
        description="This slot will be removed from the weekly schedule."
        confirmLabel="Remove"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingId!)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
