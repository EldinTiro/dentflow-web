import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { tenantService, type WeeklySchedule } from '@/features/admin/services/tenantService'
import { DEFAULT_WEEKLY_SCHEDULE, invalidOpeningDays } from '@/shared/lib/clinicSchedule'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60]
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DEFAULT_SCHEDULE = DEFAULT_WEEKLY_SCHEDULE

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

// ── Sub-components ─────────────────────────────────────────────────────────

function TimePicker24({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [h = '08', m = '00'] = value.split(':')
  const cls = `border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed`
  return (
    <div className="flex items-center gap-0.5">
      <select value={h} disabled={disabled} onChange={e => onChange(`${e.target.value}:${m}`)} className={cls}>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-gray-500 select-none font-bold text-xs dark:text-gray-400">:</span>
      <select value={m} disabled={disabled} onChange={e => onChange(`${h}:${e.target.value}`)} className={cls}>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

/** Clinic settings → working hours and slot length (was the Clinic tab of the profile). */
export function ClinicHoursPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: tenantService.getSettings,
    staleTime: 5 * 60 * 1000,
  })

  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE)
  const [localDuration, setLocalDuration] = useState(30)

  useEffect(() => {
    if (clinicSettings) {
      setLocalDuration(clinicSettings.slotDurationMinutes)
      if (clinicSettings.weeklyScheduleJson) {
        try {
          setLocalSchedule(JSON.parse(clinicSettings.weeklyScheduleJson) as WeeklySchedule)
        } catch { setLocalSchedule(DEFAULT_SCHEDULE) }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicSettings])

  function updateDay(day: string, patch: Partial<{ isOpen: boolean; start: string; end: string }>) {
    setLocalSchedule(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  // DT-13: an end before the start is shown on the row and blocks saving (the API agrees).
  const badDays = invalidOpeningDays(localSchedule)

  const saveClinicSettings = useMutation({
    mutationFn: () => tenantService.updateSettings({
      slotDurationMinutes: Number(localDuration),
      weeklyScheduleJson: JSON.stringify(localSchedule),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['clinic-settings'], updated)
      toast.success(t('profile.clinicSettings.hoursSaved'))
    },
    onError: (err) => toast.error(getApiErrorMessage(err, t('profile.clinicSettings.hoursFailed'))),
  })

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('profile.clinicSettings.hoursTitle')}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        {t('profile.clinicSettings.hoursHint')}
      </p>

      {/* Per-day schedule */}
      <div className="space-y-2 mb-5">
        <div className="grid grid-cols-[130px_1fr_1fr_1fr] gap-2 mb-1">
          <span />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">{t('profile.clinicSettings.start')}</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">{t('profile.clinicSettings.end')}</span>
          <span />
        </div>
        {DAYS.map(day => {
          const d = localSchedule[day] ?? DEFAULT_SCHEDULE[day]
          return (
            <div key={day} className={`grid grid-cols-[130px_1fr_1fr_auto] gap-2 items-center py-2 px-3 rounded-lg transition-colors ${d.isOpen ? 'bg-gray-50 dark:bg-gray-800/50' : 'opacity-50'}`}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={d.isOpen}
                  onChange={e => updateDay(day, { isOpen: e.target.checked })}
                  className="rounded accent-primary-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tc(`day.${day}`)}</span>
              </label>
              <TimePicker24 value={d.start} disabled={!d.isOpen} onChange={v => updateDay(day, { start: v })} />
              <TimePicker24 value={d.end}   disabled={!d.isOpen} onChange={v => updateDay(day, { end: v })} />
              {!d.isOpen
                ? <span className="text-xs text-gray-500 dark:text-gray-400">{t('profile.clinicSettings.closed')}</span>
                : <span />
              }
              {badDays.includes(day) && (
                <p role="alert" className="col-span-4 text-xs text-red-600 dark:text-red-400">{t('profile.clinicSettings.endBeforeStart')}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Slot duration + save */}
      <div className="flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {t('profile.clinicSettings.slotDuration')}
        </label>
        <select
          value={localDuration}
          onChange={e => setLocalDuration(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
        >
          {SLOT_DURATION_OPTIONS.map(d => (
            <option key={d} value={d}>{d} min</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => saveClinicSettings.mutate()}
          disabled={saveClinicSettings.isPending || badDays.length > 0}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {saveClinicSettings.isPending ? t('profile.clinicSettings.saving') : t('profile.clinicSettings.save')}
        </button>
      </div>
    </section>
  )
}
