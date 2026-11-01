import { describe, it, expect } from 'vitest'
import { DEFAULT_WEEKLY_SCHEDULE, daySchedule, busySlotLabels, slotOccupancy, nextBookableStart, openingHourRange } from './clinicSchedule'

describe('daySchedule', () => {
  // QA-018: Settings showed Mon–Fri 08–17 (an unsaved default) while the slot check used 08:00–22:30
  it('falls back to the same default the settings screen shows', () => {
    expect(daySchedule(null, '2026-10-22')).toEqual(DEFAULT_WEEKLY_SCHEDULE.thursday)
    expect(daySchedule(null, '2026-10-25')).toEqual({ isOpen: false, start: '08:00', end: '12:00' }) // Sunday
  })

  it('uses the saved schedule when there is one', () => {
    const saved = JSON.stringify({ ...DEFAULT_WEEKLY_SCHEDULE, thursday: { isOpen: true, start: '10:00', end: '14:00' } })
    expect(daySchedule(saved, '2026-10-22')).toEqual({ isOpen: true, start: '10:00', end: '14:00' })
  })
})

describe('busySlotLabels', () => {
  const slots = [{ label: '09:00' }, { label: '09:30' }]
  const appt = (providerId: string, start: string, end: string, status = 'Scheduled') =>
    ({ providerId, startAt: `2026-10-22T${start}:00`, endAt: `2026-10-22T${end}:00`, status })

  // QA-018: with "All providers" a slot turned red as soon as one of five providers was busy
  it('marks a slot busy for "all" only when every provider is booked', () => {
    const appointments = [appt('p1', '09:00', '09:30'), appt('p1', '09:30', '10:00'), appt('p2', '09:30', '10:00')]

    const busy = busySlotLabels(appointments, slots, '2026-10-22', 30, ['p1', 'p2'])

    expect([...busy]).toEqual(['09:30'])
  })

  it('marks a slot busy for a single provider when they are booked', () => {
    const busy = busySlotLabels([appt('p1', '09:00', '09:30')], slots, '2026-10-22', 30, ['p1'])
    expect([...busy]).toEqual(['09:00'])
  })

  it('ignores cancelled and completed appointments', () => {
    const busy = busySlotLabels([appt('p1', '09:00', '09:30', 'Cancelled')], slots, '2026-10-22', 30, ['p1'])
    expect(busy.size).toBe(0)
  })
})

describe('nextBookableStart', () => {
  const at = (local: string) => new Date(local) // local wall time (tests run in Europe/Sarajevo)

  // QA-018: "+ Book Appointment" pre-filled 01:15, outside opening hours
  it("moves a night-time now to that day's opening time", () => {
    expect(nextBookableStart(at('2026-10-22T01:15:00'), null)).toBe('2026-10-22T08:00')
  })

  it('rounds up to the next quarter hour during opening hours', () => {
    expect(nextBookableStart(at('2026-10-22T10:07:00'), null)).toBe('2026-10-22T10:15')
  })

  it('skips to the next open day after closing time and over the weekend', () => {
    expect(nextBookableStart(at('2026-10-23T17:30:00'), null)).toBe('2026-10-26T08:00') // Fri evening → Mon
  })
})

describe('slotOccupancy', () => {
  const slots = [{ label: '09:00' }, { label: '09:30' }, { label: '10:00' }]
  const appt = (providerId: string, start: string, end: string, status = 'Scheduled') =>
    ({ providerId, startAt: `2026-10-26T${start}:00`, endAt: `2026-10-26T${end}:00`, status })

  // "All providers" hid that a doctor was busy unless every doctor was (user report)
  it('lists which of the given providers are busy in each slot', () => {
    const occupancy = slotOccupancy(
      [appt('p1', '09:00', '10:00'), appt('p2', '09:30', '10:00'), appt('p3', '09:00', '09:30')],
      slots, '2026-10-26', 30, ['p1', 'p2'],
    )

    expect(occupancy.get('09:00')).toEqual(['p1'])
    expect(occupancy.get('09:30')).toEqual(['p1', 'p2'])
    expect(occupancy.get('10:00')).toEqual([])
  })

  it('ignores cancelled visits', () => {
    const occupancy = slotOccupancy([appt('p1', '09:00', '09:30', 'Cancelled')], slots, '2026-10-26', 30, ['p1'])
    expect(occupancy.get('09:00')).toEqual([])
  })
})

// DT-13: Monday 08:00 → 07:00 was saved, leaving Monday with no slots
describe('invalidOpeningDays', () => {
  it('lists open days that end before (or when) they start', async () => {
    const { invalidOpeningDays, DEFAULT_WEEKLY_SCHEDULE } = await import('./clinicSchedule')
    const schedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      monday: { isOpen: true, start: '08:00', end: '07:00' },
      tuesday: { isOpen: true, start: '09:00', end: '09:00' },
      sunday: { isOpen: false, start: '10:00', end: '08:00' }, // closed: hours don't matter
    }

    expect(invalidOpeningDays(schedule)).toEqual(['monday', 'tuesday'])
    expect(invalidOpeningDays(DEFAULT_WEEKLY_SCHEDULE)).toEqual([])
  })
})

// User request: the calendar should show only the hours the clinic works
describe('openingHourRange', () => {
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'] // Mon–Sun
  const pinkDent = JSON.stringify(Object.fromEntries(
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d, i) =>
      [d, { isOpen: i < 5, start: '10:30', end: '18:30' }]),
  ))

  it('covers the opening hours of the shown days, in whole hours', () => {
    expect(openingHourRange(pinkDent, week)).toEqual({ start: 10, end: 19 })
  })

  it('takes the earliest opening and the latest closing when days differ', () => {
    const schedule = JSON.stringify({
      ...DEFAULT_WEEKLY_SCHEDULE,
      monday: { isOpen: true, start: '08:00', end: '12:00' },
      tuesday: { isOpen: true, start: '13:00', end: '20:00' },
    })
    expect(openingHourRange(schedule, ['2026-11-02', '2026-11-03'])).toEqual({ start: 8, end: 20 })
  })

  it("uses the week's hours for a closed day, so the day view is not empty", () => {
    expect(openingHourRange(pinkDent, ['2026-11-08'])).toEqual({ start: 10, end: 19 }) // Sunday
  })

  it('has no range when the clinic is closed every day', () => {
    const closed = JSON.stringify(Object.fromEntries(
      Object.entries(DEFAULT_WEEKLY_SCHEDULE).map(([d, h]) => [d, { ...h, isOpen: false }])))
    expect(openingHourRange(closed, week)).toBeNull()
  })
})
