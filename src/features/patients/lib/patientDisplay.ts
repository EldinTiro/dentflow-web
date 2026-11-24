import type { Gender, PatientInsights } from '../services/patientService'

interface VisitSources {
  firstVisitDate: string | null
  lastVisitDate: string | null
  insights?: Pick<PatientInsights, 'firstVisitAt' | 'lastVisitAt'>
}

/** A stored date (YYYY-MM-DD) or an instant, comparable. */
const timeOf = (v: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v).getTime()

/**
 * The patient's first and last visit, the same everywhere on the record (user report
 * 2026-11-13). The visits decide; the stored dates are never updated by the app, so they
 * count only where they reach further, as from an imported paper record.
 */
export function visitDates(p: VisitSources): { first: string | null; last: string | null } {
  const pick = (a: string | null | undefined, b: string | null | undefined, later: boolean) => {
    if (!a) return b ?? null
    if (!b) return a
    return (timeOf(a) > timeOf(b)) === later ? a : b
  }
  return {
    first: pick(p.insights?.firstVisitAt, p.firstVisitDate, false),
    last: pick(p.insights?.lastVisitAt, p.lastVisitDate, true),
  }
}

/** Whole years on `now` for a YYYY-MM-DD birth date. */
export function ageOn(dateOfBirth: string | null, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null
  const [y, m, d] = dateOfBirth.split('-').map(Number)
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const TINTS = [
  'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
  'bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200',
]

/** The same patient always gets the same avatar colour. */
export function avatarTint(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

/** common:gender.* key, or null when there is nothing to say. */
export function genderKey(gender: Gender | null): string | null {
  switch (gender) {
    case 'Male': return 'gender.male'
    case 'Female': return 'gender.female'
    case 'Other': return 'gender.other'
    default: return null
  }
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "today" | "tomorrow" | null — for "Today 10:30" labels. */
export function relativeDay(value: string | Date, now: Date = new Date()): 'today' | 'tomorrow' | null {
  const d = new Date(value)
  if (sameDay(d, now)) return 'today'
  const t = new Date(now); t.setDate(t.getDate() + 1)
  return sameDay(d, t) ? 'tomorrow' : null
}
