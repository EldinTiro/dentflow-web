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
})
