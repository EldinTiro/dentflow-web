import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { useAuthStore } from '@/features/auth/store/authStore'
import { AppointmentDetailPanel } from './AppointmentDetailPanel'
import { appointmentService } from '../services/appointmentService'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: {
    getById: vi.fn(pending),
    listAllergies: vi.fn(async () => [
      { id: 'a1', allergen: 'Penicillin', severity: 'LifeThreatening', reaction: null, notes: null, reportedAt: null },
    ]),
  },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { getById: vi.fn(pending) } }))
vi.mock('@/features/billing/services/billingService', async (orig) => ({
  ...(await orig<typeof import('@/features/billing/services/billingService')>()),
  billingService: { listByPatient: vi.fn(pending) },
}))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { listTypes: vi.fn(pending), getHistory: vi.fn(), updateStatus: vi.fn() },
}))

const history = (from: string | null, to: string) => ({
  id: `${from}-${to}`, appointmentId: 'appt-1', fromStatus: from, toStatus: to, changedByUserId: null,
  reason: null, isOverride: false, changedAt: '2026-10-22T07:05:00Z',
})

describe('AppointmentDetailPanel', () => {
  beforeEach(() => {
    vi.mocked(appointmentService.getHistory).mockReset().mockResolvedValue([])
    useAuthStore.getState().clearAuth()
  })

  // QA-010: a clinician starting treatment from here never saw the allergy
  it('shows the patient allergy alert', async () => {
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Penicillin (Life-threatening)')
  })

  // QA-017: history stayed "No status changes recorded" and showed raw enum names
  // QA-027: the drawer closed after every status action
  it('stays open after a status change and shows it in the history, translated', async () => {
    const onClose = vi.fn()
    vi.mocked(appointmentService.updateStatus).mockResolvedValue(appointmentFixture({ status: 'CheckedIn' }))
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture()} onClose={onClose} onReschedule={() => {}} canManage />,
    )
    expect(await screen.findByText('No status changes recorded.')).toBeInTheDocument()
    vi.mocked(appointmentService.getHistory).mockResolvedValue([history('Scheduled', 'CheckedIn')])

    await userEvent.click(screen.getByRole('button', { name: 'Check In' }))

    await waitFor(() => expect(screen.getByText('Checked In', { selector: '[data-testid="history-to"]' })).toBeInTheDocument())
    expect(screen.queryByText('CheckedIn')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Treatment' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  // QA-034: Reschedule and Cancel were offered while treatment was in progress
  it('offers neither Reschedule nor Cancel once treatment has started', async () => {
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture({ status: 'InProgress' })} onClose={() => {}} onReschedule={() => {}} canManage />,
    )
    await screen.findByRole('button', { name: 'Complete Appointment' })

    expect(screen.queryByRole('button', { name: /reschedule/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancel/i })).not.toBeInTheDocument()
  })

  // QA-027: Escape did not close the appointment drawer
  it('closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture()} onClose={onClose} onReschedule={() => {}} canManage />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  // DT-09: "Start treatment" was offered (and accepted) for a visit two weeks ahead
  it('does not offer check-in or treatment days before the visit', async () => {
    const start = new Date(Date.now() + 15 * 86_400_000)
    renderWithProviders(
      <AppointmentDetailPanel
        appointment={appointmentFixture({ startAt: start.toISOString(), endAt: new Date(start.getTime() + 1_800_000).toISOString() })}
        onClose={() => {}} onReschedule={() => {}} canManage />,
    )

    expect(await screen.findByText(/on the day of the visit/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Treatment' })).not.toBeInTheDocument()
  })

  // DT-09: an override needed no reason and could "change" to the current status
  it('needs a reason for an override and does not offer the current status', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'O', roles: ['ClinicOwner'] })
    const user = userEvent.setup()
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture({ status: 'Completed' })} onClose={() => {}} onReschedule={() => {}} canManage />,
    )

    await user.click(await screen.findByRole('button', { name: /change status manually/i }))

    const options = [...(screen.getByRole('combobox', { name: /new status/i }) as HTMLSelectElement).options].map((o) => o.value)
    expect(options).not.toContain('Completed')
    const apply = screen.getByRole('button', { name: /apply/i })
    expect(apply).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /reason/i }), 'Entered on the wrong day')
    expect(apply).toBeEnabled()
  })

  // DT-16: an appointment whose patient is gone said "Loading…" forever
  it('says the patient could not be found instead of loading forever', async () => {
    const { patientService } = await import('@/features/patients/services/patientService')
    vi.mocked(patientService.getById).mockRejectedValueOnce(Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } }))
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
    )

    expect(await screen.findByText(/patient not found/i)).toBeInTheDocument()
  })
})
