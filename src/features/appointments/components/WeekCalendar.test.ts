import { describe, it, expect } from 'vitest'
import { calendarHourRange } from './WeekCalendar'

const appt = (start: string, end: string) => ({ startAt: start, endAt: end })

describe('calendarHourRange', () => {
  it('shows 06:00–21:00 for an ordinary week', () => {
    expect(calendarHourRange([appt('2026-10-22T09:00:00', '2026-10-22T10:00:00')])).toEqual({ start: 6, end: 21 })
  })

  // QA-029: a 00:30 booking was invisible because the grid started at 06:00
  it('extends the grid to fit early and late appointments', () => {
    expect(calendarHourRange([
      appt('2026-10-22T00:30:00', '2026-10-22T01:00:00'),
      appt('2026-10-22T21:30:00', '2026-10-22T22:15:00'),
    ])).toEqual({ start: 0, end: 23 })
  })

  // User request: only the hours the clinic works, not 06:00–21:00
  describe('with the clinic opening hours', () => {
    const open = { start: 10, end: 19 }

    it('shows just the opening hours', () => {
      expect(calendarHourRange([appt('2026-10-22T11:00:00', '2026-10-22T11:30:00')], undefined, open)).toEqual(open)
    })

    it('still stretches to show a visit booked outside them', () => {
      expect(calendarHourRange([appt('2026-10-22T08:00:00', '2026-10-22T09:00:00')], undefined, open)).toEqual({ start: 8, end: 19 })
    })

    it('does not stretch to the current time late at night', () => {
      expect(calendarHourRange([], new Date(2026, 9, 22, 23, 8), open)).toEqual(open)
    })
  })
})
