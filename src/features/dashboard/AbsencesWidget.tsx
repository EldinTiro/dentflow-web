import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarOff } from 'lucide-react'
import { staffService } from '@/features/staff/services/staffService'
import { ABSENCE_COLOR, ABSENCE_EMOJI, formatAbsenceDate } from '@/features/staff/lib/absence'
import { localDayEndUtc, localDayStartUtc, toLocalIsoDate, todayLocal } from '@/shared/lib/dates'

const DAYS_AHEAD = 14
const DAY_MS = 86_400_000

/** Whole local days from today to the day the absence starts. */
function daysUntil(startAt: string, today: string) {
  return Math.round((new Date(`${toLocalIsoDate(startAt)}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / DAY_MS)
}

/** Who is away today and in the next two weeks, so the clinic can plan around it. */
export function AbsencesWidget() {
  const { t } = useTranslation('dashboard')
  const { t: ts } = useTranslation('staff')

  const today = todayLocal()
  const last = new Date(`${today}T12:00:00`)
  last.setDate(last.getDate() + DAYS_AHEAD)
  const range = { from: localDayStartUtc(today), to: localDayEndUtc(toLocalIsoDate(last)) }

  const { data: absences, isLoading } = useQuery({
    queryKey: ['clinic-absences', range.from, range.to],
    queryFn: () => staffService.listClinicAbsences(range),
  })
  // Same query as the slot checker, so the dashboard loads the staff list once
  const { data: staff } = useQuery({
    queryKey: ['staff-all-active'],
    queryFn: () => staffService.list({ isActive: true, pageSize: 50 }),
  })

  const people = new Map((staff?.items ?? []).map((s) => [s.id, s]))
  // An absence of someone no longer in the active list is not worth planning around
  const rows = (absences ?? []).filter((a) => people.has(a.staffMemberId))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarOff size={16} className="text-primary-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('absences.title')}</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">{t('absences.subtitle')}</span>
      </div>

      {isLoading ? (
        <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700/50 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-1">{t('absences.empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {rows.map((a) => {
            const person = people.get(a.staffMemberId)!
            const days = daysUntil(a.startAt, today)
            const type = a.absenceType ?? ''
            return (
              <li key={a.id}>
                <Link
                  to={`/staff/${a.staffMemberId}?tab=absence`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: person.colorHex ?? '#6366f1' }} />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{person.fullName}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ABSENCE_COLOR[type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'}`}>
                    <span aria-hidden>{ABSENCE_EMOJI[type] ?? '📅'}</span>
                    {ts(`absence.type.${type}`, { defaultValue: type })}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAbsenceDate(a.startAt)} – {formatAbsenceDate(a.endAt)}
                  </span>
                  <span className={`ml-auto text-xs font-semibold ${days <= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`}>
                    {days <= 0 ? t('absences.today') : days === 1 ? t('absences.tomorrow') : t('absences.inDays', { count: days })}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
