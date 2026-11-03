import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
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
// The widget is tested on its own; here where it sits and what happens with a visit opened in it
vi.mock('./SlotCheckerWidget', async () => {
  const { appointmentFixture } = await import('@/test/fixtures/appointment')
  return {
    SlotCheckerWidget: ({ onAppointmentClick }: { onAppointmentClick?: (a: unknown) => void }) => (
      <div data-testid="slot-checker">
        <button onClick={() => onAppointmentClick?.(appointmentFixture({ patientName: 'Lejla Hasanović' }))}>calendar: Lejla Hasanović</button>
      </div>
    ),
  }
})

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

  // UX Phase A: acting on a visit meant a detour via Appointments. Today's schedule is now
  // the calendar in the slot widget; a visit opened there opens here, in place.
  it('opens a visit from the schedule in place', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Rec', roles: ['Staff'] })
    renderWithProviders(<DashboardPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'calendar: Lejla Hasanović' }))

    expect(await screen.findByText('Appointment detail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })

  // Roles proposal A1: revenue was on every clinic role's dashboard
  it('does not request or show clinic money to a receptionist', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Rec', roles: ['Staff'] })
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

describe('DashboardPage, the top of the page', () => {
  // User request: "Book appointment" and "Register patient" repeat the Appointments and
  // Patients pages, and took the top of the dashboard
  it('has no quick actions', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.queryByRole('link', { name: /book appointment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /register patient/i })).not.toBeInTheDocument()
  })

  // User request: the list of today's visits is replaced by the calendar under the free slots
  it("has no separate list of today's visits", () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.queryByRole('heading', { name: /today's schedule/i })).not.toBeInTheDocument()
  })
})

// User report: Bosnian showed Croatian ("utorak, 3. studenoga 2026.", "tjedan")
describe('DashboardPage in Bosnian', () => {
  afterEach(async () => { vi.useRealTimers(); await i18n.changeLanguage('en') })

  it('writes the date with Bosnian month names', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 9, 0))
    await i18n.changeLanguage('bs')
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('utorak, 3. novembra 2026.')).toBeInTheDocument()
    expect(screen.getByText('3. nov')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/studenoga|tjedan/)
  })
})

