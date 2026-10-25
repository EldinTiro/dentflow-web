import i18n from 'i18next'
import { formatDate } from '@/shared/lib/format'

/** The working day absences are measured against (local time). */
const WORKDAY_START_HOUR = 8
const WORKDAY_END_HOUR = 17
const HALF_DAY_MAX_HOURS = 5

/**
 * Working days covered by an absence. Per calendar day: nothing → 0, up to half the
 * working day → 0.5, more → 1. The modal used to divide hours by 8 (08–17 = "1.1
 * days", 08–13 = "0.6") while the list counted calendar days (QA-024).
 */
export function absenceDays(start: Date, end: Date): number {
  if (end <= start) return 0

  let total = 0
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  while (day < end) {
    const open = new Date(day); open.setHours(WORKDAY_START_HOUR, 0, 0, 0)
    const close = new Date(day); close.setHours(WORKDAY_END_HOUR, 0, 0, 0)
    const from = Math.max(open.getTime(), start.getTime())
    const to = Math.min(close.getTime(), end.getTime())
    const hours = Math.max(0, (to - from) / 3_600_000)
    if (hours > 0) total += hours <= HALF_DAY_MAX_HOURS ? 0.5 : 1
    day.setDate(day.getDate() + 1)
  }
  return total
}

/** "1 dan" / "0,5 dana" / "3 dana", "1 day" / "0.5 days", "2 Tage" — the language's plural rules. */
export function formatAbsenceDays(days: number, lang: string = i18n.language): string {
  const value = new Intl.NumberFormat(lang.startsWith('en') ? 'en-US' : 'de-DE').format(days)
  return i18n.t('staff:absence.days', { count: days, value, lng: lang })
}

/** Day-first date in the UI language (see shared formatDate; QA-024 / QA-032). */
export function formatAbsenceDate(iso: string, lang: string = i18n.language): string {
  return formatDate(iso, lang)
}

export const ABSENCE_TYPES = [
  { value: 'Vacation',         emoji: '🏖️' },
  { value: 'Sickness',         emoji: '🤒' },
  { value: 'SpecialLeave',     emoji: '📋' },
  { value: 'ReligiousHoliday', emoji: '🕌' },
  { value: 'PublicHoliday',    emoji: '🎉' },
  { value: 'Education',        emoji: '🎓' },
] as const

export type AbsenceTypeValue = typeof ABSENCE_TYPES[number]['value']

export const ABSENCE_EMOJI: Record<string, string> = Object.fromEntries(
  ABSENCE_TYPES.map((t) => [t.value, t.emoji])
)
export const ABSENCE_COLOR: Record<string, string> = {
  Vacation:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Sickness:         'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SpecialLeave:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ReligiousHoliday: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PublicHoliday:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Education:        'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}
