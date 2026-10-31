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

vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: {
    list: vi.fn(async () => ({ items: [visit], totalCount: 1, page: 1, pageSize: 200 })),
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
// The grid itself is covered by DayCalendar.test; here only what the page does with it
vi.mock('../components/DayCalendar', () => ({
  DayCalendar: (props: { date: string; providers: DayProvider[]; onMove?: (a: unknown, s: string, p?: string) => void }) => (
    <div data-testid="day-calendar" data-date={props.date}>
      {props.providers.map((p) => <span key={p.id}>{p.fullName}</span>)}
      <button onClick={() => props.onMove?.(visit, '2026-10-29T11:15', 'p2')}>drop on Ana 11:15</button>
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
    useAuthStore.getState().setAuth('t', { userId: 'u1', email: 'desk@x.ba', fullName: 'Desk', roles: ['Receptionist'] })
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

  it('asks before moving a visit, then moves it to the new doctor', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'drop on Ana 11:15' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Miroslav Vuletić → Thursday, 29/10/2026 11:15 · Ana Rozić')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }))

    expect(appointmentService.reschedule).toHaveBeenCalledWith('a1', {
      newStartAt: new Date(2026, 9, 29, 11, 15).toISOString(),
      newEndAt: new Date(2026, 9, 29, 12, 15).toISOString(),
      newProviderId: 'p2',
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
