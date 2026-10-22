import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { useAuthStore } from '@/features/auth/store/authStore'
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
vi.mock('./dashboardService', () => ({ dashboardService: { getStats: vi.fn(() => new Promise(() => {})) } }))
vi.mock('./SlotCheckerWidget', () => ({ SlotCheckerWidget: () => null }))

describe('DashboardPage', () => {
  afterEach(() => vi.useRealTimers())

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
  it('links the outstanding balance card to the invoices list', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('link', { name: /outstanding balance/i })).toHaveAttribute('href', '/invoices')
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
})
