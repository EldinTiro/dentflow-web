import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { DayCalendar } from './DayCalendar'

const providers = [
  { id: 'p1', fullName: 'Eldina Muhić', colorHex: '#ef4444' },
  { id: 'p2', fullName: 'Ana Rozić', colorHex: '#3b82f6' },
]

// Eldina sees Miroslav at 09:00; Ana is on holiday all day
const visit = appointmentFixture({
  id: 'a1', providerId: 'p1', patientId: 'pat-1', status: 'Scheduled',
  startAt: new Date(2026, 9, 29, 9, 0).toISOString(), endAt: new Date(2026, 9, 29, 10, 0).toISOString(), durationMinutes: 60,
})
const holiday = {
  id: 'b1', staffMemberId: 'p2', absenceType: 'Vacation', notes: null,
  startAt: new Date(2026, 9, 29, 0, 0).toISOString(), endAt: new Date(2026, 9, 29, 23, 0).toISOString(),
}

const baseProps = {
  date: '2026-10-29',
  providers,
  appointments: [visit],
  absences: [],
  patientNames: { 'pat-1': 'Miroslav Vuletić' },
  appointmentTypeNames: {},
}

/** jsdom has no layout: a column 840px tall (06:00–21:00 at 56px/h) at the top of the viewport. */
function pin(el: HTMLElement, left = 0) {
  el.getBoundingClientRect = () => ({ top: 0, left, right: left + 200, bottom: 840, width: 200, height: 840, x: left, y: 0, toJSON: () => ({}) })
  return el
}
const column = (container: HTMLElement, providerId: string) =>
  container.querySelector<HTMLElement>(`[data-provider-id="${providerId}"]`)!

describe('DayCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0)) // another day: the grid keeps 06:00–21:00
  })
  afterEach(() => { vi.useRealTimers() })

  // User request: only the clinic's working hours
  it('starts the grid at the clinic opening hour', () => {
    render(<DayCalendar {...baseProps} openHours={{ start: 10, end: 19 }} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.queryByText('06:00')).not.toBeInTheDocument()
  })

  it('shows one column per doctor, with their visits in it', () => {
    const { container } = render(<DayCalendar {...baseProps} />)

    expect(screen.getByText('Eldina Muhić')).toBeInTheDocument()
    expect(screen.getByText('Ana Rozić')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Miroslav Vuletić/ }).closest('[data-provider-id]')).toBe(column(container, 'p1'))
  })

  // QA pass 2026-10-31 (U-02): the names and the grid scrolled sideways on their own, so with
  // several doctors the names drifted away from their columns.
  it('scrolls the doctor names together with their columns', () => {
    const { container } = render(<DayCalendar {...baseProps} />)

    const scrollers = container.querySelectorAll('.overflow-auto, .overflow-x-auto, .overflow-y-auto')
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]).toContainElement(screen.getByText('Eldina Muhić'))
    expect(scrollers[0]).toContainElement(column(container, 'p1'))
    expect(screen.getByText('Eldina Muhić').closest('.sticky')).not.toBeNull()
  })

  it("shades a doctor's absence", () => {
    const { container } = render(<DayCalendar {...baseProps} absences={[holiday]} />)

    const absence = column(container, 'p2').querySelector('[data-testid="absence"]')
    expect(absence).toHaveTextContent('Vacation')
  })

  it('books the clicked half hour with the doctor of that column', () => {
    const onSlotClick = vi.fn()
    const { container } = render(<DayCalendar {...baseProps} onSlotClick={onSlotClick} />)

    fireEvent.click(pin(column(container, 'p2')), { clientY: 4 * 56 + 40 }) // 10:42 → 10:30

    expect(onSlotClick).toHaveBeenCalledWith('2026-10-29T10:30', 'p2')
  })

  it('draws the current-time line across the day when it is today', () => {
    vi.setSystemTime(new Date(2026, 9, 29, 10, 30))
    const { container } = render(<DayCalendar {...baseProps} />)

    expect(container.querySelector('[data-testid="now-line"]')).toHaveStyle({ top: '30%' })
  })

  it('says so when there is no doctor to show', () => {
    render(<DayCalendar {...baseProps} providers={[]} appointments={[]} />)

    expect(screen.getByText('No doctors take appointments yet.')).toBeInTheDocument()
  })
})

describe('DayCalendar drag and drop', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0))
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  function setup(appt = visit) {
    const onMove = vi.fn()
    const onAppointmentClick = vi.fn()
    const utils = render(<DayCalendar {...baseProps} appointments={[appt]} onMove={onMove} onAppointmentClick={onAppointmentClick} />)
    const chip = screen.getByRole('button', { name: /Miroslav Vuletić/ })
    // The chip starts at 09:00 = 3h below 06:00
    chip.getBoundingClientRect = () => ({ top: 3 * 56, left: 0, right: 200, bottom: 4 * 56, width: 200, height: 56, x: 0, y: 3 * 56, toJSON: () => ({}) })
    pin(column(utils.container, 'p1'), 0)
    pin(column(utils.container, 'p2'), 200)
    return { ...utils, chip, onMove, onAppointmentClick }
  }

  /** Grab the chip at its top edge and let go over `target` at `y`. */
  function drag(chip: HTMLElement, target: HTMLElement, x: number, y: number) {
    document.elementFromPoint = vi.fn(() => target)
    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * 56, button: 0 })
    fireEvent.pointerMove(window, { clientX: x, clientY: y })
    fireEvent.pointerUp(window, { clientX: x, clientY: y })
  }

  it("moves a visit to another doctor and time, snapped to 15 minutes", () => {
    const { container, chip, onMove } = setup()

    drag(chip, column(container, 'p2'), 250, 5 * 56 + 20) // 11:21 → 11:15

    expect(onMove).toHaveBeenCalledWith(visit, '2026-10-29T11:15', 'p2')
  })

  it('shows where the visit will land while dragging', () => {
    const { container, chip } = setup()
    document.elementFromPoint = vi.fn(() => column(container, 'p2'))

    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * 56, button: 0 })
    fireEvent.pointerMove(window, { clientX: 250, clientY: 5 * 56 })

    expect(column(container, 'p2').querySelector('[data-testid="drop-preview"]')).toHaveTextContent('11:00')
  })

  it('treats a tiny movement as a click', () => {
    const { container, chip, onMove, onAppointmentClick } = setup()

    drag(chip, column(container, 'p1'), 12, 3 * 56 + 2)
    fireEvent.click(chip)

    expect(onMove).not.toHaveBeenCalled()
    expect(onAppointmentClick).toHaveBeenCalledWith(visit)
  })

  it('does not open the visit after it was dragged', () => {
    const { container, chip, onAppointmentClick } = setup()

    drag(chip, column(container, 'p2'), 250, 5 * 56)
    fireEvent.click(chip)

    expect(onAppointmentClick).not.toHaveBeenCalled()
  })

  // The API refuses to move a started or finished visit (QA-034)
  it('does not let a finished visit be dragged', () => {
    const done = { ...visit, status: 'Completed' as const }
    const { container, chip, onMove } = setup(done)

    drag(chip, column(container, 'p2'), 250, 5 * 56)

    expect(onMove).not.toHaveBeenCalled()
  })
})
