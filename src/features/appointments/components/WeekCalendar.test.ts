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
})
