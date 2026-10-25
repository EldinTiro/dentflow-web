import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { staffService } from '../services/staffService'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { todayLocal } from '@/shared/lib/dates'
import { absenceDays, formatAbsenceDays, formatAbsenceDate, ABSENCE_TYPES, ABSENCE_EMOJI, ABSENCE_COLOR, type AbsenceTypeValue } from '../lib/absence'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { X, Plus, Trash2, CalendarOff } from 'lucide-react'
import { can } from '@/shared/lib/permissions'

interface Props {
  staffId: string
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


function formatDateRange(startAt: string, endAt: string): string {
  const s = formatAbsenceDate(startAt)
  const e = formatAbsenceDate(endAt)
  return s === e ? s : `${s} – ${e}`
}

function formatTime(iso: string): string {
  const h = new Date(iso).getHours()
  if (h <= 9) return i18n.t('staff:absence.part.morning')
  if (h <= 13) return i18n.t('staff:absence.part.noon')
  return i18n.t('staff:absence.part.evening')
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
    fromDate: todayLocal(),
    fromBoundary: 'morning',
    toDate: todayLocal(),
    toBoundary: 'evening',
    notes: '',
  }
}

export function StaffBlockedTimesTab({ staffId }: Props) {
  const { t } = useTranslation('staff')
  const queryClient = useQueryClient()
  const canManage = can(useAuthStore(selectRoles), 'people.manage')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const today = todayLocal()
  const formDays = form.fromDate && form.toDate
    ? absenceDays(
        new Date(buildDateTime(form.fromDate, form.fromBoundary)),
        new Date(buildDateTime(form.toDate, form.toBoundary)),
      )
    : 0

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
        throw new Error(t('absence.endBeforeStart'))
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
      toast.success(t('absence.added'))
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, t('absence.addFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffService.deleteBlockedTime(staffId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-blocked-times', staffId] })
      setDeletingId(null)
      toast.success(t('absence.removed'))
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
          {t('absence.showPast')}
        </label>
        {canManage && (
          <button
            onClick={() => { setForm(defaultForm()); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} />
            {t('absence.add')}
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('absence.loading')}</div>
      ) : blockedTimes.length === 0 ? (
        <div className="py-12 text-center">
          <CalendarOff size={32} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{showPast ? t('absence.none') : t('absence.noneUpcoming')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('absence.colType')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('absence.colPeriod')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('absence.colDuration')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('absence.colNote')}</th>
                {canManage && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {blockedTimes.map((bt) => {
                const isPast = new Date(bt.endAt) < new Date()
                const days = absenceDays(new Date(bt.startAt), new Date(bt.endAt))
                return (
                  <tr
                    key={bt.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isPast ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {bt.absenceType ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ABSENCE_COLOR[bt.absenceType] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'}`}>
                          <span>{ABSENCE_EMOJI[bt.absenceType] ?? '📅'}</span>
                          {t(`absence.type.${bt.absenceType}`, { defaultValue: bt.absenceType })}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                      {formatDateRange(bt.startAt, bt.endAt)}
                      <span className="ml-2 text-xs text-gray-500 font-normal dark:text-gray-400">
                        {formatTime(bt.startAt)} – {formatTime(bt.endAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatAbsenceDays(days)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {bt.notes ?? <span className="text-gray-500 dark:text-gray-400">—</span>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeletingId(bt.id)}
                          className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors dark:text-gray-400"
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
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('absence.modalTitle')}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 dark:text-gray-400">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('absence.typeLabel')}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceTypeValue }))}
                  className={inputCls}
                >
                  {ABSENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.emoji} {t(`absence.type.${type.value}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('absence.from')}</label>
                <input
                  type="date"
                  value={form.fromDate}
                  onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                  className={inputCls}
                />
                <div className="mt-2.5 space-y-2">
                  <label className={radioCls}>
                    <input type="radio" name="fromBoundary" value="morning" checked={form.fromBoundary === 'morning'}
                      onChange={() => setForm((f) => ({ ...f, fromBoundary: 'morning' }))} className="text-primary-600 dark:text-primary-400" />
                    {t('absence.boundary.morning')}
                  </label>
                  <label className={radioCls}>
                    <input type="radio" name="fromBoundary" value="lunchtime" checked={form.fromBoundary === 'lunchtime'}
                      onChange={() => setForm((f) => ({ ...f, fromBoundary: 'lunchtime' }))} className="text-primary-600 dark:text-primary-400" />
                    {t('absence.boundary.lunchtime')}
                  </label>
                </div>
              </div>

              {/* To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('absence.to')}</label>
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
                      onChange={() => setForm((f) => ({ ...f, toBoundary: 'lunchtime' }))} className="text-primary-600 dark:text-primary-400" />
                    {t('absence.boundary.lunchtime')}
                  </label>
                  <label className={radioCls}>
                    <input type="radio" name="toBoundary" value="evening" checked={form.toBoundary === 'evening'}
                      onChange={() => setForm((f) => ({ ...f, toBoundary: 'evening' }))} className="text-primary-600 dark:text-primary-400" />
                    {t('absence.boundary.evening')}
                  </label>
                </div>
              </div>

              {/* Summary pill */}
              {form.fromDate && form.toDate && (
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-2.5 text-sm text-primary-700 dark:text-primary-400">
                  {formDays > 0 ? `📅 ${formatAbsenceDays(formDays)}` : `⚠️ ${t('absence.invalidPeriod')}`}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('absence.note')} <span className="text-gray-500 font-normal dark:text-gray-400">{t('absence.optional')}</span>
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('absence.notePlaceholder')}
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
                {t('absence.close')}
              </button>
              <button
                disabled={addMutation.isPending || formDays <= 0}
                onClick={() => addMutation.mutate()}
                className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? t('absence.saving') : t('absence.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title={t('absence.removeTitle')}
        description={t('absence.removeBody')}
        confirmLabel={t('absence.remove')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingId!)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
