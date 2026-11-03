import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { staffService } from '@/features/staff/services/staffService'
import { SlotCheckerWidget } from './SlotCheckerWidget'

vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: { getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })) },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'p1', fullName: 'Eldina Muhić', isBookable: true },
        { id: 'p2', fullName: 'Ana Rozić', isBookable: true },
      ],
      totalCount: 2, page: 1, pageSize: 50,
    })),
    listClinicAbsences: vi.fn(async () => []),
  },
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: {
    list: vi.fn(async () => ({
      items: [
        // Eldina 08:30–09:30, Ana 13:30–14:00 — never both at once
        { id: 'a1', providerId: 'p1', patientId: 'pat-1', patientName: 'Miroslav Vuletić', appointmentTypeId: 't1', durationMinutes: 60, status: 'Scheduled', startAt: '2026-10-26T08:30:00', endAt: '2026-10-26T09:30:00' },
        { id: 'a2', providerId: 'p2', patientId: 'pat-2', patientName: 'Karlo Mijatović', appointmentTypeId: 't1', durationMinutes: 30, status: 'Scheduled', startAt: '2026-10-26T13:30:00', endAt: '2026-10-26T14:00:00' },
      ],
      totalCount: 2, page: 1, pageSize: 200,
    })),
    listTypes: vi.fn(async () => [{ id: 't1', name: 'Kontrola' }]),
  },
}))

describe('SlotCheckerWidget — all providers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00')) // a Monday; default schedule 08:00–17:00
  })
  afterEach(() => vi.useRealTimers())

  // User report: "Svi doktori" showed 19 free · 0 booked while two doctors had visits
  it('marks slots where only some doctors are busy as partly booked', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await vi.waitFor(() => expect(screen.getByRole('link', { name: /08:30/ })).toHaveAttribute('data-state', 'partial'))
    const slot0830 = screen.getByRole('link', { name: /08:30/ })
    expect(slot0830).toHaveTextContent('1/2')
    expect(slot0830).toHaveAttribute('title', expect.stringContaining('Eldina Muhić'))
    expect(screen.getByRole('link', { name: /^08:00/ })).toHaveAttribute('data-state', 'free')

    expect(await screen.findByText('16 free')).toBeInTheDocument()
    expect(screen.getByText('3 partly booked')).toBeInTheDocument()
    expect(screen.getByText('0 booked')).toBeInTheDocument()
  })

  // Booking from a partly booked slot goes to the doctor who is actually free
  it('books a partly booked slot with the free doctor', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await vi.waitFor(() => expect(screen.getByRole('link', { name: /13:30/ })).toHaveAttribute('data-free-provider', 'p1'))
  })

  it('shows the opening hours without doubled minutes', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    expect(await screen.findByText(/08:00 – 17:00/)).toBeInTheDocument()
    expect(screen.queryByText(/08:00:00/)).not.toBeInTheDocument()
  })
})

describe('SlotCheckerWidget — days of the week', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00')) // Monday
  })
  afterEach(() => vi.useRealTimers())

  // User request: switch between the clinic's working days instead of a date picker
  it('offers one tab per day the clinic is open, with what is still free', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^MonMonday\s*26\.10\./), expect.stringMatching(/^TueTuesday\s*27\.10\./),
      expect.stringMatching(/^WedWednesday\s*28\.10\./), expect.stringMatching(/^ThuThursday\s*29\.10\./),
      expect.stringMatching(/^FriFriday\s*30\.10\./),
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    // Monday: 19 slots, all bookable with at least one doctor free
    await vi.waitFor(() => expect(tabs[0]).toHaveTextContent('19 free'))
    expect(tabs[1]).toHaveTextContent('19 free')
  })

  it('switches day on a tab', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await userEvent.click((await screen.findAllByRole('tab'))[1])

    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true')
    await vi.waitFor(() => expect(screen.getByRole('link', { name: /^13:30/ })).toHaveAttribute('data-state', 'free'))
  })

  it('steps a week at a time', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await userEvent.click(await screen.findByRole('button', { name: 'Next week' }))

    expect((await screen.findAllByRole('tab'))[0]).toHaveTextContent(/^MonMonday\s*2\.11\./)
    await userEvent.click(screen.getByRole('button', { name: 'This week' }))
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent(/^MonMonday\s*26\.10\./)
  })

  // Booking 08:00 at 10:15 makes no sense, and days already gone can't be picked
  it('greys out what is already past', async () => {
    vi.setSystemTime(new Date('2026-10-27T10:15:00')) // Tuesday
    renderWithProviders(<SlotCheckerWidget />)

    const tabs = await screen.findAllByRole('tab')
    expect(tabs[0]).toBeDisabled()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('10:00')).toHaveAttribute('data-state', 'past')
    expect(screen.queryByRole('link', { name: /^10:00/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^10:30/ })).toBeInTheDocument()
  })
})

describe('SlotCheckerWidget — closed days (DT-29)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T07:00:00')) // a Sunday; closed by default
  })
  afterEach(() => vi.useRealTimers())

  // There is no Sunday tab: the widget opens on the next day the clinic works
  it('opens on the next open day', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    const tabs = await screen.findAllByRole('tab')
    expect(tabs[0]).toHaveTextContent(/^MonMonday\s*26\.10\./)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/closed on this day/i)).not.toBeInTheDocument()
  })
})

// User request: replace "Today's schedule" with a calendar under the free slots, per doctor
describe('SlotCheckerWidget — calendar under the slots', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00')) // Monday
  })
  afterEach(() => vi.useRealTimers())

  it('shows the chosen day as a calendar, one column per doctor', async () => {
    const { container } = renderWithProviders(<SlotCheckerWidget />)

    expect(await screen.findByRole('button', { name: /Miroslav Vuletić/ })).toBeInTheDocument()
    expect([...container.querySelectorAll('[data-provider-id]')].map((c) => c.getAttribute('data-provider-id'))).toEqual(['p1', 'p2'])
  })

  it("shows only the chosen doctor's column", async () => {
    const { container } = renderWithProviders(<SlotCheckerWidget />)
    await screen.findByRole('option', { name: 'Ana Rozić' })

    await userEvent.selectOptions(screen.getByRole('combobox'), 'p2')

    expect([...container.querySelectorAll('[data-provider-id]')].map((c) => c.getAttribute('data-provider-id'))).toEqual(['p2'])
    expect(await screen.findByRole('button', { name: /Karlo Mijatović/ })).toBeInTheDocument()
  })

  it('opens a visit from the calendar', async () => {
    const onAppointmentClick = vi.fn()
    renderWithProviders(<SlotCheckerWidget onAppointmentClick={onAppointmentClick} />)

    await userEvent.click(await screen.findByRole('button', { name: /Miroslav Vuletić/ }))

    expect(onAppointmentClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
  })
})

// User report: a doctor's new colour showed in Appointments but not on the dashboard calendar
describe('SlotCheckerWidget — staff changes', () => {
  it('refreshes the doctors when staff data changes', async () => {
    const { queryClient } = renderWithProviders(<SlotCheckerWidget />)
    await screen.findByRole('option', { name: 'Ana Rozić' })
    const calls = vi.mocked(staffService.list).mock.calls.length

    // What saving a staff profile does
    await queryClient.invalidateQueries({ queryKey: ['staff'] })

    await vi.waitFor(() => expect(vi.mocked(staffService.list).mock.calls.length).toBeGreaterThan(calls))
  })
})

// User request: there is room for full day names; phones keep the short ones
describe('SlotCheckerWidget — day names', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('names the day in full, and short only on small screens', async () => {
    renderWithProviders(<SlotCheckerWidget />)
    const tab = (await screen.findAllByRole('tab'))[0]

    expect(tab.querySelector('[class="sm:hidden"]')).toHaveTextContent('Mon')
    expect(tab.querySelector('[class="hidden sm:inline"]')).toHaveTextContent('Monday')
  })
})

