import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { appointmentService } from '../services/appointmentService'
import { staffService } from '@/features/staff/services/staffService'
import { AppointmentsPage } from './AppointmentsPage'
import type { DayProvider } from '../components/DayCalendar'

const visit = appointmentFixture({
  id: 'a1', providerId: 'p1', patientId: 'pat-1', patientName: 'Miroslav Vuletić', status: 'Scheduled',
  startAt: new Date(2026, 9, 29, 9, 0).toISOString(), endAt: new Date(2026, 9, 29, 10, 0).toISOString(), durationMinutes: 60,
} as never)

const cancelled = appointmentFixture({
  id: 'a2', providerId: 'p1', patientId: 'pat-2', patientName: 'Ajdin Kubat', status: 'Cancelled',
  startAt: new Date(2026, 9, 29, 13, 30).toISOString(), endAt: new Date(2026, 9, 29, 13, 45).toISOString(), durationMinutes: 15,
} as never)

vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: {
    list: vi.fn(async () => ({ items: [visit, cancelled], totalCount: 2, page: 1, pageSize: 200 })),
    listTypes: vi.fn(async () => []),
    reschedule: vi.fn(async () => visit),
  },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'p1', fullName: 'Eldina Muhić', colorHex: '#ef4444', isActive: true, isBookable: true },
        { id: 'p2', fullName: 'Ana Rozić', colorHex: '#3b82f6', isActive: true, isBookable: true },
        { id: 'r1', fullName: 'Recepcija', colorHex: null, isActive: true, isBookable: false },
      ],
      totalCount: 3, page: 1, pageSize: 100,
    })),
    listClinicAbsences: vi.fn(async () => []),
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getSettings: vi.fn(async () => ({
      slotDurationMinutes: 30,
      weeklyScheduleJson: JSON.stringify({ thursday: { isOpen: true, start: '10:30', end: '18:30' } }),
    })),
  },
}))
// The grid itself is covered by DayCalendar.test; here only what the page does with it
vi.mock('../components/DayCalendar', () => ({
  DayCalendar: (props: { date: string; providers: DayProvider[]; appointments: { id: string }[]; onPrev?: () => void; onNext?: () => void; openHours?: { start: number; end: number } | null; onMove?: (a: unknown, s: string, p?: string) => void; onResize?: (a: unknown, s: string, e: string) => void }) => (
    <div data-testid="day-calendar" data-date={props.date} data-visits={props.appointments.map((a) => a.id).join(',')} data-open={props.openHours ? `${props.openHours.start}-${props.openHours.end}` : ''}>
      {props.providers.map((p) => <span key={p.id}>{p.fullName}</span>)}
      <button onClick={() => props.onMove?.(visit, '2026-10-29T11:15', 'p2')}>drop on Ana 11:15</button>
      <button onClick={() => props.onResize?.(visit, '2026-10-29T09:00', '2026-10-29T10:30')}>end at 10:30</button>
      <button onClick={() => props.onResize?.(visit, '2026-10-29T09:30', '2026-10-29T10:00')}>start at 09:30</button>
    </div>
  ),
}))

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

function renderPage(route = '/appointments?view=day&day=2026-10-29') {
  return renderWithProviders(
    <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
    { route },
  )
}

describe('AppointmentsPage day view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 8, 0))
    useAuthStore.getState().setAuth('t', { userId: 'u1', email: 'desk@x.ba', fullName: 'Desk', roles: ['Staff'] })
  })
  afterEach(() => { vi.useRealTimers(); useAuthStore.getState().clearAuth() })

  it('shows a column for every doctor who takes appointments', async () => {
    renderPage()

    const day = await screen.findByTestId('day-calendar')
    expect(await within(day).findByText('Eldina Muhić')).toBeInTheDocument()
    expect(within(day).getByText('Ana Rozić')).toBeInTheDocument()
    expect(within(day).queryByText('Recepcija')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
  })

  // User request: the calendar shows only the hours the clinic works
  it("gives the calendar the clinic's opening hours for that day", async () => {
    renderPage() // Thursday 29 Oct, open 10:30–18:30

    const day = await screen.findByTestId('day-calendar')
    await vi.waitFor(() => expect(day).toHaveAttribute('data-open', '10-19'))
  })

  // Client report: a cancelled visit kept its slot looking taken
  it('leaves cancelled visits off the calendar, so their slot can be booked', async () => {
    renderPage()

    await vi.waitFor(async () => expect(await screen.findByTestId('day-calendar')).toHaveAttribute('data-visits', 'a1'))
  })

  it('switches between day and week and keeps it in the URL', async () => {
    renderPage('/appointments')

    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(screen.getByTestId('location')).toHaveTextContent('view=day')
    expect(await screen.findByTestId('day-calendar')).toBeInTheDocument()
  })

  // QA pass 2026-10-31 (U-01): Day jumped back to today from whatever week was on screen.
  it('opens the day view on the week that is shown, not on today', async () => {
    renderPage('/appointments?from=2026-12-16')

    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(await screen.findByTestId('day-calendar')).toHaveAttribute('data-date', '2026-12-14')
  })

  it('stays on the week shown when Week is clicked again', async () => {
    renderPage('/appointments?from=2026-12-16')

    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(await screen.findByTestId('day-calendar')).toHaveAttribute('data-date', '2026-12-14')
  })

  it('opens the day view on today when today is in the week shown', async () => {
    renderPage('/appointments')

    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(await screen.findByTestId('day-calendar')).toHaveAttribute('data-date', '2026-10-29')
  })

  it('goes back to the week of the day that was shown', async () => {
    renderPage('/appointments?view=day&day=2026-12-16')

    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(await screen.findByTestId('day-calendar')).toHaveAttribute('data-date', '2026-12-14')
  })

  it('steps one day at a time', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))

    expect(screen.getByTestId('day-calendar')).toHaveAttribute('data-date', '2026-10-30')
    expect(screen.getByText('Friday, 30/10/2026')).toBeInTheDocument()
  })

  it('steps days with the arrow keys', async () => {
    renderPage()
    await screen.findByTestId('day-calendar')

    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByTestId('day-calendar')).toHaveAttribute('data-date', '2026-10-30')
  })

  it('asks before moving a visit, then moves it to the new doctor', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'drop on Ana 11:15' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Miroslav Vuletić')
    expect(dialog).toHaveTextContent('Thursday, 29/10/2026 · 11:15')
    expect(dialog).toHaveTextContent('Ana Rozić')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }))

    expect(appointmentService.reschedule).toHaveBeenCalledWith('a1', {
      newStartAt: new Date(2026, 9, 29, 11, 15).toISOString(),
      newEndAt: new Date(2026, 9, 29, 12, 15).toISOString(),
      newProviderId: 'p2',
    })
  })

  // User request 2026-11-10: resizing a visit asks first, then saves the new end
  it('asks before changing the length, then keeps the start and saves the new end', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'end at 10:30' }))
    const dialog = screen.getByRole('dialog', { name: 'Change the length?' })
    expect(dialog).toHaveTextContent('Miroslav Vuletić')
    expect(dialog).toHaveTextContent('09:00 – 10:30')
    expect(dialog).toHaveTextContent('90 min')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(appointmentService.reschedule).toHaveBeenCalledWith('a1', {
      newStartAt: new Date(2026, 9, 29, 9, 0).toISOString(),
      newEndAt: new Date(2026, 9, 29, 10, 30).toISOString(),
    })
  })

  it('saves a new start when the top edge was pulled', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'start at 09:30' }))
    const dialog = screen.getByRole('dialog', { name: 'Change the length?' })
    expect(dialog).toHaveTextContent('09:30 – 10:00')
    expect(dialog).toHaveTextContent('30 min')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(appointmentService.reschedule).toHaveBeenCalledWith('a1', {
      newStartAt: new Date(2026, 9, 29, 9, 30).toISOString(),
      newEndAt: new Date(2026, 9, 29, 10, 0).toISOString(),
    })
  })

  it('moves nothing when the move is cancelled', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'drop on Ana 11:15' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(appointmentService.reschedule).not.toHaveBeenCalled()
  })

  it('loads the absences of that day', async () => {
    renderPage()

    await screen.findByTestId('day-calendar')
    expect(staffService.listClinicAbsences).toHaveBeenCalledWith({
      from: new Date(2026, 9, 29, 0, 0).toISOString(),
      to: new Date(2026, 9, 29, 23, 59, 59, 999).toISOString(),
    })
  })
})
