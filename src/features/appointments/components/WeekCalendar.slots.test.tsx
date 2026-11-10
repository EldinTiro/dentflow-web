import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { WeekCalendar } from './WeekCalendar'
import { MIN_HOUR_PX as H } from './calendarGrid'

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
  col.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 15 * H, width: 100, height: 15 * H, x: 0, y: 0, toJSON: () => ({}) })
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

    // Grid starts at 06:00 with H px per hour: 4h 34min → rounds down to 10:30
    fireEvent.click(dayColumn(container, '2026-10-22'), { clientY: 4 * H + (34 / 60) * H })

    expect(onSlotClick).toHaveBeenCalledWith('2026-10-22T10:30')
  })

  // User request: only the clinic's working hours, so the grid starts at opening time
  it('starts the grid at the clinic opening hour and books from there', () => {
    const onSlotClick = vi.fn()
    const { container } = render(
      <WeekCalendar {...props} appointments={[]} onSlotClick={onSlotClick} openHours={{ start: 10, end: 19 }} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.queryByText('06:00')).not.toBeInTheDocument()
    expect(screen.queryByText('19:00')).not.toBeInTheDocument()
    fireEvent.click(dayColumn(container, '2026-10-22'), { clientY: H + (34 / 60) * H }) // 1h 34min after 10:00
    expect(onSlotClick).toHaveBeenCalledWith('2026-10-22T11:30')
  })

  // User request 2026-11-10: show which slot a click would book, before clicking
  it('highlights the slot under the mouse with its start time, and clears it on leaving', () => {
    const { container } = render(<WeekCalendar {...props} appointments={[]} onSlotClick={vi.fn()} />)
    const col = dayColumn(container, '2026-10-22')

    fireEvent.mouseMove(col, { clientY: 4 * H + (34 / 60) * H })

    expect(screen.getByTestId('slot-preview')).toHaveTextContent('10:30')
    fireEvent.mouseLeave(col)
    expect(screen.queryByTestId('slot-preview')).not.toBeInTheDocument()
  })

  it('does not highlight a slot over an existing visit, or for someone who cannot book', () => {
    const visit = appointmentFixture({ startAt: '2026-10-22T08:00:00Z', endAt: '2026-10-22T08:30:00Z' })
    const { container, rerender } = render(<WeekCalendar {...props} appointments={[visit]} onSlotClick={vi.fn()} />)

    fireEvent.mouseMove(screen.getByRole('button', { name: /Lejla Hasanović/ }), { clientY: 4 * H + (34 / 60) * H })
    expect(screen.queryByTestId('slot-preview')).not.toBeInTheDocument()

    rerender(<WeekCalendar {...props} appointments={[]} />)
    fireEvent.mouseMove(dayColumn(container, '2026-10-22'), { clientY: 4 * H + (34 / 60) * H })
    expect(screen.queryByTestId('slot-preview')).not.toBeInTheDocument()
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
