import type { DaySchedule, WeeklySchedule } from '@/features/admin/services/tenantService'

/**
 * What Settings → Klinika shows before anything is saved. The slot checker used to
 * fall back to 08:00–22:30 instead, so the two disagreed (QA-018). One default.
 */
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday:    { isOpen: true,  start: '08:00', end: '17:00' },
  tuesday:   { isOpen: true,  start: '08:00', end: '17:00' },
  wednesday: { isOpen: true,  start: '08:00', end: '17:00' },
  thursday:  { isOpen: true,  start: '08:00', end: '17:00' },
  friday:    { isOpen: true,  start: '08:00', end: '17:00' },
  saturday:  { isOpen: false, start: '08:00', end: '12:00' },
  sunday:    { isOpen: false, start: '08:00', end: '12:00' },
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function parseWeeklySchedule(json: string | null | undefined): WeeklySchedule {
  if (!json) return DEFAULT_WEEKLY_SCHEDULE
  try {
    return { ...DEFAULT_WEEKLY_SCHEDULE, ...(JSON.parse(json) as WeeklySchedule) }
  } catch {
    return DEFAULT_WEEKLY_SCHEDULE
  }
}

/** Opening hours for a local calendar date (`YYYY-MM-DD`). */
export function daySchedule(json: string | null | undefined, date: string): DaySchedule {
  const key = DAY_KEYS[new Date(`${date}T00:00:00`).getDay()]
  return parseWeeklySchedule(json)[key]
}

const ACTIVE_STATUSES = new Set(['Scheduled', 'CheckedIn', 'InProgress'])

interface BookedSlot {
  providerId: string
  startAt: string
  endAt: string
  status: string
}

/**
 * Slot labels (`HH:mm`, local) that cannot take another booking: a slot is busy only
 * when every provider in `providerIds` already has an active appointment in it.
 * For a single provider that is simply "they are booked"; for "All providers" one
 * busy dentist no longer marks the slot as taken (QA-018).
 */
export function busySlotLabels(
  appointments: BookedSlot[],
  slots: { label: string }[],
  date: string,
  durationMinutes: number,
  providerIds: string[],
): Set<string> {
  const busy = new Set<string>()
  if (providerIds.length === 0) return busy

  const active = appointments.filter((a) => ACTIVE_STATUSES.has(a.status))
  for (const slot of slots) {
    const slotStart = new Date(`${date}T${slot.label}:00`).getTime()
    const slotEnd = slotStart + durationMinutes * 60_000
    const bookedProviders = new Set(
      active
        .filter((a) => new Date(a.startAt).getTime() < slotEnd && new Date(a.endAt).getTime() > slotStart)
        .map((a) => a.providerId),
    )
    if (providerIds.every((id) => bookedProviders.has(id))) busy.add(slot.label)
  }
  return busy
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Earliest bookable start from `now`, as a `datetime-local` value: the next quarter
 * hour if the clinic is open, else the next opening time. The booking drawer used to
 * pre-fill "now" — 01:15 at night (QA-018).
 */
export function nextBookableStart(now: Date, scheduleJson: string | null | undefined): string {
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(Math.ceil(candidate.getMinutes() / 15) * 15)

  for (let day = 0; day < 14; day++) {
    const date = localDate(candidate)
    const hours = daySchedule(scheduleJson, date)
    if (hours.isOpen) {
      const open = new Date(`${date}T${hours.start}:00`)
      const close = new Date(`${date}T${hours.end}:00`)
      if (candidate < open) return `${date}T${hours.start}`
      if (candidate < close) return `${date}T${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`
    }
    candidate.setDate(candidate.getDate() + 1)
    candidate.setHours(0, 0, 0, 0)
  }
  return `${localDate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}` // no open day configured
}
