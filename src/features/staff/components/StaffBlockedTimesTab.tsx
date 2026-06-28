import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { staffService } from '../services/staffService'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useAuthStore } from '@/features/auth/store/authStore'
import { X, Plus, Trash2, CalendarOff } from 'lucide-react'

interface Props {
  staffId: string
}

const ABSENCE_TYPES = [
  { value: 'Vacation',         label: 'Godišnji odmor',   emoji: '🏖️' },
  { value: 'Sickness',         label: 'Bolovanje',         emoji: '🤒' },
  { value: 'SpecialLeave',     label: 'Slobodan dan',      emoji: '📋' },
  { value: 'ReligiousHoliday', label: 'Vjerski praznik',   emoji: '🕌' },
  { value: 'PublicHoliday',    label: 'Državni praznik',   emoji: '🎉' },
  { value: 'Education',        label: 'Edukacija / kurs',  emoji: '🎓' },
] as const

type AbsenceTypeValue = typeof ABSENCE_TYPES[number]['value']

const ABSENCE_LABEL: Record<string, string> = Object.fromEntries(
  ABSENCE_TYPES.map((t) => [t.value, t.label])
)
const ABSENCE_EMOJI: Record<string, string> = Object.fromEntries(
  ABSENCE_TYPES.map((t) => [t.value, t.emoji])
)
const ABSENCE_COLOR: Record<string, string> = {
  Vacation:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Sickness:         'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SpecialLeave:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ReligiousHoliday: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PublicHoliday:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Education:        'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}

type DayBoundary = 'morning' | 'lunchtime' | 'evening'

const BOUNDARY_HOURS: Record<DayBoundary, number> = {
  morning:   8,
  lunchtime: 13,
  evening:   17,
}

function buildDateTime(dateStr: string, boundary: DayBoundary): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(BOUNDARY_HOURS[boundary], 0, 0, 0)
  return d.toISOString()
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDateRange(startAt: string, endAt: string): string {
  const s = new Date(startAt)
  const e = new Date(endAt)
  const fmt = (d: Date) =>
    d.toLocaleDateString('bs-BA', { day: 'numeric', month: 'short', year: 'numeric' })
  return fmt(s) === fmt(e) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`
}

function formatTime(iso: string): string {
  const h = new Date(iso).getHours()
  if (h <= 9) return 'Jutro'
  if (h <= 13) return 'Podne'
  return 'Večer'
}

interface FormState {
  type: AbsenceTypeValue
  fromDate: string
  fromBoundary: 'morning' | 'lunchtime'
  toDate: string
  toBoundary: 'lunchtime' | 'evening'
  notes: string
}

function defaultForm(): FormState {
  return {
    type: 'Vacation',
    fromDate: todayStr(),
    fromBoundary: 'morning',
    toDate: todayStr(),
    toBoundary: 'evening',
    notes: '',
  }
}

export function StaffBlockedTimesTab({ staffId }: Props) {
  const queryClient = useQueryClient()
  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const today = todayStr()

  const { data: blockedTimes = [], isLoading } = useQuery({
    queryKey: ['staff-blocked-times', staffId, showPast],
    queryFn: () =>
      staffService.listBlockedTimes(staffId, showPast ? undefined : { from: today }),
  })

  const addMutation = useMutation({
    mutationFn: () => {
      const startAt = buildDateTime(form.fromDate, form.fromBoundary)
      const endAt = buildDateTime(form.toDate, form.toBoundary)
      if (new Date(startAt) >= new Date(endAt))
        throw new Error('Datum završetka mora biti nakon datuma početka.')
      return staffService.addBlockedTime(staffId, {
        startAt,
        endAt,
        absenceType: form.type,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setShowModal(false)
      setForm(defaultForm())
      toast.success('Odsustvo dodano.')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Greška pri dodavanju odsustva.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffService.deleteBlockedTime(staffId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setDeletingId(null)
      toast.success('Odsustvo uklonjeno.')
    },
  })

  const inputCls =
    'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const radioCls = 'flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="rounded"
          />
          Prikaži prošla odsustva
        </label>
        {canManage && (
          <button
            onClick={() => { setForm(defaultForm()); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} />
            Dodaj odsustvo
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Učitavanje…</div>
      ) : blockedTimes.length === 0 ? (
        <div className="py-12 text-center">
          <CalendarOff size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">Nema {showPast ? '' : 'predstojećih '}odsustva.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tip</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trajanje</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Napomena</th>
                {canManage && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {blockedTimes.map((bt) => {
                const isPast = new Date(bt.endAt) < new Date()
                const startDay = new Date(bt.startAt).toDateString()
                const endDay = new Date(bt.endAt).toDateString()
                const days = Math.ceil(
                  (new Date(bt.endAt).getTime() - new Date(bt.startAt).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <tr
                    key={bt.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isPast ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {bt.absenceType ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ABSENCE_COLOR[bt.absenceType] ?? 'bg-gray-100 text-gray-600'}`}>
                          <span>{ABSENCE_EMOJI[bt.absenceType] ?? '📅'}</span>
                          {ABSENCE_LABEL[bt.absenceType] ?? bt.absenceType}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                      {formatDateRange(bt.startAt, bt.endAt)}
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        {formatTime(bt.startAt)} – {formatTime(bt.endAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {startDay === endDay ? '1 dan' : `${days} dana`}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {bt.notes ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeletingId(bt.id)}
                          className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-50 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <CalendarOff size={16} className="text-white" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Zahtjev za odsustvo</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tip odsustva</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceTypeValue }))}
                  className={inputCls}
                >
                  {ABSENCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Od</label>
                <input
                  type="date"
                  value={form.fromDate}
                  onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                  className={inputCls}
                />
                <div className="mt-2.5 space-y-2">
                  <label className={radioCls}>
                    <input type="radio" name="fromBoundary" value="morning" checked={form.fromBoundary === 'morning'}
                      onChange={() => setForm((f) => ({ ...f, fromBoundary: 'morning' }))} className="text-primary-600" />
                    Jutro (08:00)
                  </label>
                  <label className={radioCls}>
                    <input type="radio" name="fromBoundary" value="lunchtime" checked={form.fromBoundary === 'lunchtime'}
                      onChange={() => setForm((f) => ({ ...f, fromBoundary: 'lunchtime' }))} className="text-primary-600" />
                    Podne (13:00)
                  </label>
                </div>
              </div>

              {/* To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Do</label>
                <input
                  type="date"
                  value={form.toDate}
                  min={form.fromDate}
                  onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                  className={inputCls}
                />
                <div className="mt-2.5 space-y-2">
                  <label className={radioCls}>
                    <input type="radio" name="toBoundary" value="lunchtime" checked={form.toBoundary === 'lunchtime'}
                      onChange={() => setForm((f) => ({ ...f, toBoundary: 'lunchtime' }))} className="text-primary-600" />
                    Podne (13:00)
                  </label>
                  <label className={radioCls}>
                    <input type="radio" name="toBoundary" value="evening" checked={form.toBoundary === 'evening'}
                      onChange={() => setForm((f) => ({ ...f, toBoundary: 'evening' }))} className="text-primary-600" />
                    Večer (17:00)
                  </label>
                </div>
              </div>

              {/* Summary pill */}
              {form.fromDate && form.toDate && (
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-2.5 text-sm text-primary-700 dark:text-primary-400">
                  {(() => {
                    const start = new Date(`${form.fromDate}T${String(BOUNDARY_HOURS[form.fromBoundary]).padStart(2,'0')}:00:00`)
                    const end = new Date(`${form.toDate}T${String(BOUNDARY_HOURS[form.toBoundary]).padStart(2,'0')}:00:00`)
                    const diffH = (end.getTime() - start.getTime()) / 3600000
                    if (diffH <= 0) return '⚠️ Nevažeći period'
                    const days = diffH / 8
                    return `📅 ${days % 1 === 0 ? days : days.toFixed(1)} ${days === 1 ? 'dan' : 'dana'}`
                  })()}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Napomena <span className="text-gray-400 font-normal">(opciono)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Dodatne informacije…"
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Zatvori
              </button>
              <button
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate()}
                className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? 'Čuvam…' : 'Potvrdi odsustvo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Ukloni odsustvo?"
        description="Ovo odsustvo će biti trajno uklonjeno iz sistema."
        confirmLabel="Ukloni"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingId!)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
