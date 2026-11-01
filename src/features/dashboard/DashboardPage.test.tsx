import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { useAuthStore } from '@/features/auth/store/authStore'
import { dashboardService } from './dashboardService'
import { renderWithProviders } from '@/test/render'
import { DashboardPage } from './DashboardPage'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { patientService } from '@/features/patients/services/patientService'

const { empty, pending } = vi.hoisted(() => ({
  empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 1 }),
  pending: () => new Promise<never>(() => {}),
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []), getHistory: vi.fn(async () => []) },
}))
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: { list: vi.fn(empty), getById: vi.fn(pending), listAllergies: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty), getById: vi.fn(pending) } }))
vi.mock('@/features/billing/services/billingService', async (orig) => ({
  ...(await orig<typeof import('@/features/billing/services/billingService')>()),
  billingService: { listByPatient: vi.fn(pending) },
}))
vi.mock('./dashboardService', () => ({
  dashboardService: {
    getStats: vi.fn(() => new Promise(() => {})),
    getFinance: vi.fn(async () => ({ revenueThisMonth: 1234, outstandingBalance: 56 })),
  },
}))
vi.mock('./SlotCheckerWidget', () => ({ SlotCheckerWidget: () => <div data-testid="slot-checker" /> }))

describe('DashboardPage', () => {
  afterEach(() => vi.useRealTimers())

  // User request: staff use the free-slot check most, so it sits at the top, before the numbers
  it('shows the free-slot check above the stat cards', () => {
    renderWithProviders(<DashboardPage />)

    const slotChecker = screen.getByTestId('slot-checker')
    const firstStat = screen.getByText("Today's Appointments")
    expect(slotChecker.compareDocumentPosition(firstStat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // QA-035: "Pending Confirmation" = 180 — every Scheduled visit ever, past ones included
  it('counts only upcoming scheduled appointments as pending confirmation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'))
    renderWithProviders(<DashboardPage />)

    await waitFor(() =>
      expect(appointmentService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Scheduled', dateFrom: '2026-10-22' }),
      ),
    )
  })

  // QA-033: the dashboard downloaded 500 patients just to label today's appointments
  it('does not download the whole patient list', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(appointmentService.list).toHaveBeenCalled())
    expect(patientService.list).not.toHaveBeenCalledWith(expect.objectContaining({ pageSize: 500 }))
  })

  // UX Phase A: the card linked to /billing, which is not a route — the click silently landed on "/"
  it('links the outstanding balance card to the debtors list', () => {
    // The card is clinic-level money, so only finance roles see it
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('link', { name: /outstanding balance/i })).toHaveAttribute('href', '/finance/debtors')
    useAuthStore.getState().clearAuth()
  })

  // UX Phase A: today's schedule rows were read-only; acting on a visit meant a detour via Appointments
  it("opens the appointment from today's schedule in place", async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Rec', roles: ['Receptionist'] })
    vi.mocked(appointmentService.list).mockResolvedValue({
      items: [appointmentFixture({ patientName: 'Lejla Hasanović' })], totalCount: 1, page: 1, pageSize: 50,
    } as Awaited<ReturnType<typeof appointmentService.list>>)
    renderWithProviders(<DashboardPage />)

    await userEvent.click(await screen.findByRole('button', { name: /Lejla Hasanović/ }))

    expect(await screen.findByText('Appointment detail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })

  // Roles proposal A1: revenue was on every clinic role's dashboard
  it('does not request or show clinic money to a receptionist', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Rec', roles: ['Receptionist'] })
    vi.mocked(dashboardService.getFinance).mockClear()
    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(appointmentService.list).toHaveBeenCalled())
    expect(dashboardService.getFinance).not.toHaveBeenCalled()
    expect(screen.queryByText(/revenue this month/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/outstanding balance/i)).not.toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })

  it("shows the owner the clinic's revenue", async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText(/1,234 KM/)).toBeInTheDocument()
    expect(screen.getByText(/revenue this month/i)).toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })
})
