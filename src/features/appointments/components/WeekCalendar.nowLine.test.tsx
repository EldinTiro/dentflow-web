import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { WeekCalendar } from './WeekCalendar'

const props = {
  weekStart: new Date(2026, 9, 19), // Monday 19 Oct 2026
  appointments: [],
  providerColors: {},
  providerNames: {},
  patientNames: {},
  appointmentTypeNames: {},
}

const nowLine = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-testid="now-line"]')

// User request: a red line at the current time, like Google Calendar, to find "now" at a glance
describe('WeekCalendar current-time line', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it("sits in today's column at the current time", () => {
    vi.setSystemTime(new Date(2026, 9, 22, 10, 30)) // Thursday 10:30
    const { container } = render(<WeekCalendar {...props} />)

    const line = nowLine(container)!
    expect(line.closest('[data-day]')).toHaveAttribute('data-day', '2026-10-22')
    // Grid 06:00–21:00 = 900 min; 10:30 is 270 min in
    expect(line.style.top).toBe('30%')
  })

  it('moves as time passes', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 10, 30))
    const { container } = render(<WeekCalendar {...props} />)

    act(() => { vi.advanceTimersByTime(90 * 60_000) }) // 12:00

    expect(nowLine(container)!.style.top).toBe('40%')
  })

  it('is not drawn on another week', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 10, 30))
    const { container } = render(<WeekCalendar {...props} />)

    expect(nowLine(container)).toBeNull()
  })

  // Checked at 02:57 the grid started at 06:00 and the line was nowhere to be seen
  it('stretches the grid to the current hour, early in the morning', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 2, 57))
    const { container } = render(<WeekCalendar {...props} />)

    expect(container).toHaveTextContent('02:00')
    // Grid 02:00–21:00 = 1140 min; 02:57 is 57 min in
    expect(nowLine(container)!.style.top).toBe('5%')
  })

  it('stretches the grid to the current hour, late in the evening', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 23, 15))
    const { container } = render(<WeekCalendar {...props} />)

    expect(container).toHaveTextContent('23:00')
    expect(nowLine(container)).not.toBeNull()
  })

  it('keeps the usual hours on another week', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 2, 57))
    const { container } = render(<WeekCalendar {...props} />)

    expect(container).not.toHaveTextContent('02:00')
  })
})
