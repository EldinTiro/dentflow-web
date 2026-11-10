import { describe, it, expect } from 'vitest'
import { layoutDay } from './calendarGrid'
import type { AppointmentResponse } from '../services/appointmentService'

const visit = (id: string, start: string, end: string) =>
  ({ id, startAt: `2026-11-10T${start}:00`, endAt: `2026-11-10T${end}:00` }) as AppointmentResponse

// User report 2026-11-10: Alma's Tuesday visits jumped between the left and the right half.
// One long visit overlapping a row of short ones put every short one in its own column.
describe('layoutDay', () => {
  it('keeps back-to-back visits in one column next to a visit that overlaps them', () => {
    const layout = layoutDay([
      visit('long', '11:30', '13:00'),
      visit('a', '11:30', '11:45'),
      visit('b', '11:45', '12:00'),
      visit('c', '12:00', '12:15'),
      visit('d', '12:15', '12:30'),
    ])

    expect(layout.get('long')).toEqual({ col: 0, cols: 2 })
    for (const id of ['a', 'b', 'c', 'd']) expect(layout.get(id)).toEqual({ col: 1, cols: 2 })
  })

  it('gives a visit that overlaps nothing the full width', () => {
    expect(layoutDay([visit('x', '09:00', '09:30')]).get('x')).toEqual({ col: 0, cols: 1 })
  })
})
