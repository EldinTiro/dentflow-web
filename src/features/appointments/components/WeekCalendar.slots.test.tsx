import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { WeekCalendar } from './WeekCalendar'

const props = {
  weekStart: new Date(2026, 9, 19), // Monday 19 Oct 2026
  providerColors: {},
  providerNames: {},
  patientNames: { 'pat-1': 'Lejla Hasanović' },
  appointmentTypeNames: {},
}

/** jsdom has no layout: pin a day column to the top of the viewport. */
function dayColumn(container: HTMLElement, date: string) {
  const col = container.querySelector<HTMLElement>(`[data-day="${date}"]`)
  if (!col) throw new Error(`no column for ${date}`)
  col.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 840, width: 100, height: 840, x: 0, y: 0, toJSON: () => ({}) })
  return col
}

describe('WeekCalendar click-to-book', () => {
  // The grid stretches to the current hour on the current week; pin a daytime clock
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 22, 10, 0)) })
  afterEach(() => { vi.useRealTimers() })

  // UX Phase A: empty time on the calendar did nothing; booking needed a detour
  // through "+ Book Appointment" and retyping the date and time
  it('books the half hour that was clicked', () => {
    const onSlotClick = vi.fn()
    const { container } = render(<WeekCalendar {...props} appointments={[]} onSlotClick={onSlotClick} />)

    // Grid starts at 06:00 with 56px per hour: 4h + 32px ≈ 10:34 → rounds down to 10:30
    fireEvent.click(dayColumn(container, '2026-10-22'), { clientY: 4 * 56 + 32 })

    expect(onSlotClick).toHaveBeenCalledWith('2026-10-22T10:30')
  })

  it('opens an existing appointment instead of booking over it', () => {
    const onSlotClick = vi.fn()
    const onAppointmentClick = vi.fn()
    render(
      <WeekCalendar
        {...props}
        appointments={[appointmentFixture({ startAt: '2026-10-22T08:00:00Z', endAt: '2026-10-22T08:30:00Z' })]}
        onSlotClick={onSlotClick}
        onAppointmentClick={onAppointmentClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Lejla Hasanović/ }))

    expect(onAppointmentClick).toHaveBeenCalled()
    expect(onSlotClick).not.toHaveBeenCalled()
  })
})
