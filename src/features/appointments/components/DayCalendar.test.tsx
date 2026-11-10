import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { DayCalendar } from './DayCalendar'
import { MIN_HOUR_PX as H } from './calendarGrid'

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

/** jsdom has no layout: a column 840px tall (06:00–21:00 at Hpx/h) at the top of the viewport. */
function pin(el: HTMLElement, left = 0) {
  el.getBoundingClientRect = () => ({ top: 0, left, right: left + 200, bottom: 15 * H, width: 200, height: 15 * H, x: left, y: 0, toJSON: () => ({}) })
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

  // User request 2026-11-10 (variant B): step days from the calendar itself
  it('has previous and next day arrows in its doctor header', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<DayCalendar {...baseProps} onPrev={onPrev} onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
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

    fireEvent.click(pin(column(container, 'p2')), { clientY: 4 * H + 40 }) // 10:42 → 10:30

    expect(onSlotClick).toHaveBeenCalledWith('2026-10-29T10:30', 'p2')
  })

  // User request 2026-11-10: show which slot a click would book, in that doctor's column
  it("highlights the slot under the mouse in that doctor's column only", () => {
    const { container } = render(<DayCalendar {...baseProps} onSlotClick={vi.fn()} />)
    const col = pin(column(container, 'p2'))

    fireEvent.mouseMove(col, { clientY: 4 * H + 40 })

    const preview = screen.getByTestId('slot-preview')
    expect(preview).toHaveTextContent('10:30')
    expect(col).toContainElement(preview)
    fireEvent.mouseLeave(col)
    expect(screen.queryByTestId('slot-preview')).not.toBeInTheDocument()
  })

  it('draws the current-time line across the day when it is today', () => {
    vi.setSystemTime(new Date(2026, 9, 29, 10, 30))
    const { container } = render(<DayCalendar {...baseProps} />)

    expect(container.querySelector('[data-testid="now-line"]')).toHaveStyle({ top: '30%' })
    // User request 2026-11-10: and the time itself on the time axis
    expect(container.querySelector('[data-testid="now-label"]')).toHaveTextContent('10:30')
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
    chip.getBoundingClientRect = () => ({ top: 3 * H, left: 0, right: 200, bottom: 4 * H, width: 200, height: H, x: 0, y: 3 * H, toJSON: () => ({}) })
    pin(column(utils.container, 'p1'), 0)
    pin(column(utils.container, 'p2'), 200)
    return { ...utils, chip, onMove, onAppointmentClick }
  }

  /** Grab the chip at its top edge and let go over `target` at `y`. */
  function drag(chip: HTMLElement, target: HTMLElement, x: number, y: number) {
    document.elementFromPoint = vi.fn(() => target)
    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * H, button: 0 })
    fireEvent.pointerMove(window, { clientX: x, clientY: y })
    fireEvent.pointerUp(window, { clientX: x, clientY: y })
  }

  it("moves a visit to another doctor and time, snapped to 15 minutes", () => {
    const { container, chip, onMove } = setup()

    drag(chip, column(container, 'p2'), 250, 5 * H + 20) // 11:21 → 11:15

    expect(onMove).toHaveBeenCalledWith(visit, '2026-10-29T11:15', 'p2')
  })

  it('shows where the visit will land while dragging', () => {
    const { container, chip } = setup()
    document.elementFromPoint = vi.fn(() => column(container, 'p2'))

    fireEvent.pointerDown(chip, { clientX: 10, clientY: 3 * H, button: 0 })
    fireEvent.pointerMove(window, { clientX: 250, clientY: 5 * H })

    expect(column(container, 'p2').querySelector('[data-testid="drop-preview"]')).toHaveTextContent('11:00')
  })

  it('treats a tiny movement as a click', () => {
    const { container, chip, onMove, onAppointmentClick } = setup()

    drag(chip, column(container, 'p1'), 12, 3 * H + 2)
    fireEvent.click(chip)

    expect(onMove).not.toHaveBeenCalled()
    expect(onAppointmentClick).toHaveBeenCalledWith(visit)
  })

  it('does not open the visit after it was dragged', () => {
    const { container, chip, onAppointmentClick } = setup()

    drag(chip, column(container, 'p2'), 250, 5 * H)
    fireEvent.click(chip)

    expect(onAppointmentClick).not.toHaveBeenCalled()
  })

  // User report 2026-11-10: a drop in a column also opened the booking drawer, because the
  // browser sends a click to the column after the pointer is let go there
  it('does not book a slot when a visit is dropped in a column', async () => {
    const onSlotClick = vi.fn()
    const { container } = render(<DayCalendar {...baseProps} onMove={vi.fn()} onSlotClick={onSlotClick} />)
    const chip = screen.getByRole('button', { name: /Miroslav Vuletić/ })
    chip.getBoundingClientRect = () => ({ top: 3 * H, left: 0, right: 200, bottom: 4 * H, width: 200, height: H, x: 0, y: 3 * H, toJSON: () => ({}) })
    const p1 = pin(column(container, 'p1'), 0)

    drag(chip, p1, 20, 5 * H)
    fireEvent.click(p1, { clientY: 5 * H })
    expect(onSlotClick).not.toHaveBeenCalled()

    // The next real click still books
    await new Promise((r) => setTimeout(r, 0))
    fireEvent.click(p1, { clientY: 5 * H })
    expect(onSlotClick).toHaveBeenCalledTimes(1)
  })

  // User request 2026-11-10: change a visit's length by dragging its bottom edge
  describe('resizing', () => {
    function setupResize() {
      const onResize = vi.fn()
      const onMove = vi.fn()
      const onAppointmentClick = vi.fn()
      const utils = render(<DayCalendar {...baseProps} onMove={onMove} onResize={onResize} onAppointmentClick={onAppointmentClick} />)
      const p1 = pin(column(utils.container, 'p1'), 0)
      const chip = screen.getByRole('button', { name: /Miroslav Vuletić/ })
      const handle = utils.container.querySelector<HTMLElement>('[data-testid="resize-handle"][data-edge="bottom"]')!
      const topHandle = utils.container.querySelector<HTMLElement>('[data-testid="resize-handle"][data-edge="top"]')!
      return { ...utils, p1, chip, handle, topHandle, onResize, onMove, onAppointmentClick }
    }
    /** Grab the bottom edge (10:00 = 4h below 06:00) and let go at `y`. */
    function pull(handle: HTMLElement, y: number) {
      fireEvent.pointerDown(handle, { clientX: 10, clientY: 4 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: y })
      fireEvent.pointerUp(window, { clientX: 10, clientY: y })
    }

    it('sets a new end, snapped to 15 minutes, keeping the start', () => {
      const { handle, onResize, onMove } = setupResize()

      pull(handle, 4.5 * H + 3) // 10:33 → 10:30

      expect(onResize).toHaveBeenCalledWith(visit, '2026-10-29T09:00', '2026-10-29T10:30')
      expect(onMove).not.toHaveBeenCalled()
    })

    it('keeps at least 15 minutes', () => {
      const { handle, onResize } = setupResize()

      pull(handle, 2 * H) // above the start

      expect(onResize).toHaveBeenCalledWith(visit, '2026-10-29T09:00', '2026-10-29T09:15')
    })

    it('stretches the visit while pulling', () => {
      const { handle, chip } = setupResize()

      fireEvent.pointerDown(handle, { clientX: 10, clientY: 4 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: 5 * H })

      expect(chip).toHaveTextContent('09:00 – 11:00')
    })

    it('does not open the visit after resizing it', () => {
      const { handle, chip, onAppointmentClick } = setupResize()

      pull(handle, 5 * H)
      fireEvent.click(chip)

      expect(onAppointmentClick).not.toHaveBeenCalled()
    })

    // User report 2026-11-10: pulling the top edge down did nothing; it changes the start
    it('sets a new start from the top edge, keeping the end', () => {
      const { topHandle, onResize, onMove } = setupResize()

      fireEvent.pointerDown(topHandle, { clientX: 10, clientY: 3 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: 3.5 * H })
      fireEvent.pointerUp(window, { clientX: 10, clientY: 3.5 * H })

      expect(onResize).toHaveBeenCalledWith(visit, '2026-10-29T09:30', '2026-10-29T10:00')
      expect(onMove).not.toHaveBeenCalled()
    })

    it('keeps at least 15 minutes when the top is pulled past the end', () => {
      const { topHandle, onResize } = setupResize()

      fireEvent.pointerDown(topHandle, { clientX: 10, clientY: 3 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: 6 * H })
      fireEvent.pointerUp(window, { clientX: 10, clientY: 6 * H })

      expect(onResize).toHaveBeenCalledWith(visit, '2026-10-29T09:45', '2026-10-29T10:00')
    })

    it('moves the top of the visit while pulling it', () => {
      const { topHandle, chip } = setupResize()

      fireEvent.pointerDown(topHandle, { clientX: 10, clientY: 3 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: 2 * H })

      expect(chip).toHaveTextContent('08:00 – 10:00')
    })

    // A drag the browser takes over (pointercancel) left the visit stretched with no dialog
    it('puts the visit back when the browser cancels the pull', () => {
      const { handle, chip, onResize } = setupResize()

      fireEvent.pointerDown(handle, { clientX: 10, clientY: 4 * H, button: 0 })
      fireEvent.pointerMove(window, { clientX: 10, clientY: 5 * H })
      fireEvent.pointerCancel(window, { clientX: 10, clientY: 5 * H })
      fireEvent.pointerUp(window, { clientX: 10, clientY: 5 * H })

      expect(chip).toHaveTextContent('09:00 – 10:00')
      expect(onResize).not.toHaveBeenCalled()
    })

    it('has no handle on a finished visit', () => {
      const { container } = render(<DayCalendar {...baseProps} appointments={[{ ...visit, status: 'Completed' as const }]} onResize={vi.fn()} />)

      expect(container.querySelector('[data-testid="resize-handle"]')).toBeNull()
    })
  })

  // The API refuses to move a started or finished visit (QA-034)
  it('does not let a finished visit be dragged', () => {
    const done = { ...visit, status: 'Completed' as const }
    const { container, chip, onMove } = setup(done)

    drag(chip, column(container, 'p2'), 250, 5 * H)

    expect(onMove).not.toHaveBeenCalled()
  })
})

// User request: use the empty space under the grid, so 15-minute visits can be read
describe('DayCalendar height', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it("shows the clinic's opening hours only", () => {
    render(<DayCalendar {...baseProps} openHours={{ start: 10, end: 19 }} appointments={[]} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.queryByText('09:00')).not.toBeInTheDocument()
    expect(screen.queryByText('19:00')).not.toBeInTheDocument()
  })

  it('stretches the hours to fill the height there is', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: (entries: { contentRect: { height: number } }[]) => void) {}
      observe() { this.cb([{ contentRect: { height: 945 } }]) }
      disconnect() {}
    })
    render(<DayCalendar {...baseProps} openHours={{ start: 10, end: 19 }} appointments={[]} />)

    // 9 hours in 945px, less the 45px doctor row
    expect(screen.getByText('10:00')).toHaveStyle({ height: '100px' })
  })

  // Bug: the doctors load after the calendar, so the grid appeared later than the
  // measuring started, and the hours never grew (229px left empty in the browser)
  it('still fills the height when the doctors arrive later', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: (entries: { contentRect: { height: number } }[]) => void) {}
      observe() { this.cb([{ contentRect: { height: 945 } }]) }
      disconnect() {}
    })
    const { rerender } = render(<DayCalendar {...baseProps} providers={[]} openHours={{ start: 10, end: 19 }} appointments={[]} />)

    rerender(<DayCalendar {...baseProps} openHours={{ start: 10, end: 19 }} appointments={[]} />)

    expect(screen.getByText('10:00')).toHaveStyle({ height: '100px' })
  })
})
