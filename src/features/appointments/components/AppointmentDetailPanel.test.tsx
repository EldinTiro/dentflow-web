import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { useAuthStore } from '@/features/auth/store/authStore'
import { AppointmentDetailPanel } from './AppointmentDetailPanel'
import { appointmentService } from '../services/appointmentService'
import { patientService } from '@/features/patients/services/patientService'
import { billingService } from '@/features/billing/services/billingService'
import { Routes, Route, useLocation } from 'react-router'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: {
    getById: vi.fn(pending),
    openCard: vi.fn(),
    listAllergies: vi.fn(async () => [
      { id: 'a1', allergen: 'Penicillin', severity: 'LifeThreatening', reaction: null, notes: null, reportedAt: null },
    ]),
  },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { getById: vi.fn(pending) } }))
vi.mock('@/features/billing/services/billingService', async (orig) => ({
  ...(await orig<typeof import('@/features/billing/services/billingService')>()),
  billingService: { listByPatient: vi.fn(pending), create: vi.fn() },
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
    expect(screen.getByRole('button', { name: 'Finish visit' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  // Client request 2026-11-10: a patient booked by email has no card until they come
  it('offers to open the card when a patient without one checks in', async () => {
    vi.mocked(patientService.getById).mockResolvedValueOnce({ id: 'pat-1', fullName: 'Anita Zaimović', patientNumber: null, status: 'Active' } as never)
    vi.mocked(appointmentService.updateStatus).mockResolvedValue(appointmentFixture({ status: 'CheckedIn' }))
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
    )
    expect(await screen.findByText('No card')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Check In' }))

    expect(await screen.findByRole('dialog', { name: /open card/i })).toBeInTheDocument()
  })

  // QA-034: Reschedule and Cancel were offered while treatment was in progress
  it('offers neither Reschedule nor Cancel once treatment has started', async () => {
    renderWithProviders(
      <AppointmentDetailPanel appointment={appointmentFixture({ status: 'InProgress' })} onClose={() => {}} onReschedule={() => {}} canManage />,
    )
    await screen.findByRole('button', { name: 'Finish visit' })

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

  // User request 2026-11-11 (variant A): the steps of the visit and one main button for the next one
  describe('visit actions', () => {
    const steps = () => screen.getByRole('list', { name: 'Visit progress' })

    it('offers no "Start treatment"; checking in is the one main action', async () => {
      renderWithProviders(
        <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
      )

      expect(await screen.findByRole('button', { name: 'Check In' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Start Treatment' })).not.toBeInTheDocument()
      expect(within(steps()).getByText('Scheduled').closest('li')).toHaveAttribute('aria-current', 'step')
    })

    it('finishes a visit straight from checked in', async () => {
      vi.mocked(appointmentService.updateStatus).mockResolvedValue(appointmentFixture({ status: 'Completed' }))
      renderWithProviders(
        <AppointmentDetailPanel appointment={appointmentFixture({ status: 'CheckedIn' })} onClose={() => {}} onReschedule={() => {}} canManage />,
      )
      expect(within(steps()).getByText('Arrived').closest('li')).toHaveAttribute('aria-current', 'step')

      await userEvent.click(screen.getByRole('button', { name: 'Finish visit' }))

      expect(appointmentService.updateStatus).toHaveBeenCalledWith('appt-1', 'Completed')
      await waitFor(() => expect(within(steps()).getByText('Done').closest('li')).toHaveAttribute('aria-current', 'step'))
    })

    // A no-show had no action left at all: book them again, same patient and doctor
    it('offers Rebook as the main action for a no-show', async () => {
      const onRebook = vi.fn()
      const missed = appointmentFixture({ status: 'NoShow' })
      renderWithProviders(
        <AppointmentDetailPanel appointment={missed} onClose={() => {}} onReschedule={() => {}} onRebook={onRebook} canManage />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Rebook' }))

      expect(onRebook).toHaveBeenCalledWith(missed)
      expect(screen.queryByRole('list', { name: 'Visit progress' })).not.toBeInTheDocument()
    })

    // User request 2026-11-13 (variant C): no More button; closing a visit sits apart, one click away
    it('shows No show and Cancel directly, apart from Reschedule, with no More button', async () => {
      vi.mocked(appointmentService.updateStatus).mockResolvedValue(appointmentFixture({ status: 'NoShow' }))
      renderWithProviders(
        <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
      )

      expect(await screen.findByRole('button', { name: 'Reschedule' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
      const closing = screen.getByRole('group', { name: 'Close the visit' })
      expect(within(closing).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      await userEvent.click(within(closing).getByRole('button', { name: 'No Show' }))

      expect(appointmentService.updateStatus).toHaveBeenCalledWith('appt-1', 'NoShow')
    })

    it('offers no No show once the patient has arrived', async () => {
      renderWithProviders(
        <AppointmentDetailPanel appointment={appointmentFixture({ status: 'CheckedIn' })} onClose={() => {}} onReschedule={() => {}} canManage />,
      )

      await screen.findByRole('button', { name: 'Finish visit' })
      expect(screen.queryByRole('button', { name: 'No Show' })).not.toBeInTheDocument()
    })

    it('keeps the manual status change for the owner only', async () => {
      renderWithProviders(
        <AppointmentDetailPanel appointment={appointmentFixture()} onClose={() => {}} onReschedule={() => {}} canManage />,
      )

      await screen.findByRole('button', { name: 'Reschedule' })
      expect(screen.queryByRole('button', { name: /change status manually/i })).not.toBeInTheDocument()
    })

    it('creates the invoice and opens it to add the items', async () => {
      vi.mocked(billingService.listByPatient).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 5 } as never)
      vi.mocked(appointmentService.listTypes).mockResolvedValue([{ id: 'type-1', name: 'Filling', defaultFee: 40 }] as never)
      vi.mocked(billingService.create).mockResolvedValue({ id: 'inv-1' } as never)
      function Where() { return <p data-testid="where">{useLocation().pathname}</p> }
      renderWithProviders(
        <Routes><Route path="*" element={<>
          <AppointmentDetailPanel appointment={appointmentFixture({ status: 'Completed', appointmentTypeId: 'type-1' })} onClose={() => {}} onReschedule={() => {}} canManage />
          <Where />
        </>} /></Routes>,
      )

      await userEvent.click(await screen.findByRole('button', { name: 'Create invoice' }))

      await waitFor(() => expect(billingService.create).toHaveBeenCalledWith('pat-1', expect.objectContaining({
        appointmentId: 'appt-1',
        lineItems: [expect.objectContaining({ description: 'Filling', unitFee: 40, quantity: 1 })],
      })))
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/invoices/inv-1'))
      expect(screen.queryByText('New invoice')).not.toBeInTheDocument()
    })
  })
})
