import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { WeekCalendar } from './WeekCalendar'
import { MIN_HOUR_PX as H } from './calendarGrid'

const visit = appointmentFixture({
  id: 'a1', patientId: 'pat-1', status: 'Scheduled', durationMinutes: 60,
  startAt: new Date(2026, 9, 22, 9, 0).toISOString(), endAt: new Date(2026, 9, 22, 10, 0).toISOString(),
})

const props = {
  weekStart: new Date(2026, 9, 19), // Monday 19 Oct 2026
  appointments: [visit],
  providerColors: {},
  providerNames: {},
  patientNames: { 'pat-1': 'Miroslav Vuletić' },
  appointmentTypeNames: {},
}

function pin(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 15 * H, width: 100, height: 15 * H, x: 0, y: 0, toJSON: () => ({}) })
  return el
}

describe('WeekCalendar drag and drop', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0)) // not this week: the grid keeps 06:00–21:00
  })
  afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await i18n.changeLanguage('en') })

  // User request: move a visit by dragging it, in the week as in the day view
  it('moves a visit to another day and time, keeping the doctor', () => {
    const onMove = vi.fn()
    const { container } = render(<WeekCalendar {...props} onMove={onMove} />)
    const chip = screen.getByRole('button', { name: /Miroslav Vuletić/ })
    chip.getBoundingClientRect = () => ({ top: 3 * H, left: 0, right: 100, bottom: 4 * H, width: 100, height: H, x: 0, y: 3 * H, toJSON: () => ({}) })
    const friday = pin(container.querySelector<HTMLElement>('[data-day="2026-10-23"]')!)
    document.elementFromPoint = vi.fn(() => friday)

    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * H, button: 0 })
    fireEvent.pointerMove(window, { clientX: 400, clientY: 4 * H })
    fireEvent.pointerUp(window, { clientX: 400, clientY: 4 * H })

    expect(onMove).toHaveBeenCalledWith(visit, '2026-10-23T10:00', undefined)
  })

  // User report 2026-11-10: a drop also opened the booking drawer on the slot below it
  it('does not book a slot when a visit is dropped in a day', async () => {
    const onSlotClick = vi.fn()
    const { container } = render(<WeekCalendar {...props} onMove={vi.fn()} onSlotClick={onSlotClick} />)
    const chip = screen.getByRole('button', { name: /Miroslav Vuletić/ })
    chip.getBoundingClientRect = () => ({ top: 3 * H, left: 0, right: 100, bottom: 4 * H, width: 100, height: H, x: 0, y: 3 * H, toJSON: () => ({}) })
    const thursday = pin(container.querySelector<HTMLElement>('[data-day="2026-10-22"]')!)
    document.elementFromPoint = vi.fn(() => thursday)

    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * H, button: 0 })
    fireEvent.pointerMove(window, { clientX: 10, clientY: 5 * H })
    fireEvent.pointerUp(window, { clientX: 10, clientY: 5 * H })
    fireEvent.click(thursday, { clientY: 5 * H })
    expect(onSlotClick).not.toHaveBeenCalled()

    // The next real click still books
    await new Promise((r) => setTimeout(r, 0))
    fireEvent.click(thursday, { clientY: 5 * H })
    expect(onSlotClick).toHaveBeenCalledTimes(1)
  })

  // The week header was English whatever the language
  it('names the days in the selected language', async () => {
    await i18n.changeLanguage('bs')
    render(<WeekCalendar {...props} />)

    expect(screen.getByText('Pon')).toBeInTheDocument()
    // Full names where there is room (user request); the short ones stay for phones
    expect(screen.getByText('Ponedjeljak')).toHaveClass('hidden', 'sm:inline')
    expect(screen.getByText('Ned')).toBeInTheDocument()
  })
})
