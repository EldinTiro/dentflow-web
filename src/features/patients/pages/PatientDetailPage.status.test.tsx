import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { toast } from 'sonner'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService, type PatientResponse } from '../services/patientService'
import { PatientDetailPage } from './PatientDetailPage'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: {
    getById: vi.fn(),
    listAllergies: vi.fn(async () => []),
    listEmergencyContacts: vi.fn(async () => [{ id: 'c1', name: 'Mother', relationship: 'Mother', phonePrimary: null, isPrimary: true }]),
    getMedicalHistory: vi.fn(async () => null),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    delete: vi.fn(),
    deleteAllergy: vi.fn(async () => undefined),
  },
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { list: vi.fn(pending), listTypes: vi.fn(async () => []), getAvailableSlots: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: { list: vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 100 })) },
}))
vi.mock('@/features/admin/services/tenantService', () => ({ tenantService: { getSettings: vi.fn(pending) } }))
vi.mock('@/features/auth/services/userService', () => ({ userService: { getPreferences: vi.fn(async () => ({ timeFormat: '24h' })) } }))

const svc = vi.mocked(patientService)

function patient(overrides: Partial<PatientResponse> = {}) {
  return {
    id: 'p1', patientNumber: 'P-1', firstName: 'Selma', lastName: 'Aganović', fullName: 'Selma Aganović',
    status: 'Active', preferredName: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: null,
    deactivatedAt: null, deactivationReason: null, ...overrides,
  } as PatientResponse
}

function renderAs(role: string, route = '/patients/p1') {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: [role] })
  return renderWithProviders(
    <Routes><Route path="/patients/:id" element={<PatientDetailPage />} /></Routes>,
    { route },
  )
}

const dialog = async () => within(await screen.findByRole('dialog'))

// People-merge plan B7 / D8: patients are deactivated, not deleted
describe('PatientDetailPage status', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { useAuthStore.getState().clearAuth() })

  it.each(['ClinicOwner', 'Dentist', 'DentalNurse', 'Receptionist'])('lets %s deactivate with an optional reason', async (role) => {
    svc.getById.mockResolvedValue(patient())
    svc.deactivate.mockResolvedValue(patient({ status: 'Inactive' }))
    const user = userEvent.setup()
    renderAs(role)

    await user.click(await screen.findByRole('button', { name: /^deactivate$/i }))
    const d = await dialog()
    await user.type(d.getByLabelText(/reason/i), 'Moved to Sarajevo')
    await user.click(d.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(svc.deactivate).toHaveBeenCalledWith('p1', 'Moved to Sarajevo'))
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('says how many upcoming appointments block deactivation', async () => {
    svc.getById.mockResolvedValue(patient())
    svc.deactivate.mockRejectedValue(Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, errors: [
        { name: 'patient.HasUpcomingAppointments', reason: 'x' },
        { name: 'patient.HasUpcomingAppointments.count', reason: '2' },
      ] } },
    }))
    const user = userEvent.setup()
    renderAs('Receptionist')

    await user.click(await screen.findByRole('button', { name: /^deactivate$/i }))
    await user.click((await dialog()).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/2 upcoming appointments/i)))
  })

  it('shows an inactive patient with a banner and Reactivate', async () => {
    svc.getById.mockResolvedValue(patient({ status: 'Inactive', deactivatedAt: '2026-10-20T09:00:00Z', deactivationReason: 'Moved away' }))
    svc.reactivate.mockResolvedValue(patient())
    const user = userEvent.setup()
    renderAs('Receptionist')

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/inactive/i)
    expect(banner).toHaveTextContent('Moved away')
    await user.click(within(banner).getByRole('button', { name: /reactivate/i }))

    await waitFor(() => expect(svc.reactivate).toHaveBeenCalledWith('p1'))
  })

  it('explains that a patient with history cannot be deleted as a duplicate', async () => {
    svc.getById.mockResolvedValue(patient())
    svc.delete.mockRejectedValue(fastEndpointsError('x', 'patient.HasHistory', 409))
    const user = userEvent.setup()
    renderAs('Receptionist')

    await user.click(await screen.findByRole('button', { name: /delete duplicate/i }))
    await user.click((await dialog()).getByRole('button', { name: /delete duplicate/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/deactivate/i)))
  })

  // B0: a Dentist got 403 on emergency contacts, and the UI hid the controls too
  it('lets a Dentist remove an emergency contact', async () => {
    svc.getById.mockResolvedValue(patient())
    renderAs('Dentist', '/patients/p1?tab=medical')

    expect(await screen.findByRole('button', { name: /remove contact/i })).toBeInTheDocument()
  })

  // DT-10: one click on the trash icon removed an allergy, no confirm and no feedback
  it('asks before removing an allergy and confirms it was removed', async () => {
    svc.getById.mockResolvedValue(patient())
    svc.listAllergies.mockResolvedValue([{ id: 'a1', allergen: 'Penicillin', severity: 'Severe', reaction: null, notes: null, reportedAt: null }] as never)
    const user = userEvent.setup()
    renderAs('Dentist', '/patients/p1?tab=medical')

    await user.click(await screen.findByRole('button', { name: /remove allergy penicillin/i }))
    await user.click((await dialog()).getByRole('button', { name: /cancel/i }))
    expect(svc.deleteAllergy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /remove allergy penicillin/i }))
    await user.click((await dialog()).getByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(svc.deleteAllergy).toHaveBeenCalledWith('p1', 'a1'))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })
})
