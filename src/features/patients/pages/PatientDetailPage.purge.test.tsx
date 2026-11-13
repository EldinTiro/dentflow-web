import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { PatientDetailPage } from './PatientDetailPage'
import { patientService } from '../services/patientService'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: {
    getById: vi.fn(async () => ({
      id: 'p1', patientNumber: 'P-000001', firstName: 'Lejla', lastName: 'Hasanović', fullName: 'Lejla Hasanović',
      status: 'Active', gender: 'Female', dateOfBirth: '1992-03-12', phoneMobile: null, preferredName: null,
      parentName: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: null, hasHistory: true,
      firstVisitDate: null, lastVisitDate: null,
    })),
    listAllergies: vi.fn(async () => []),
    timeline: vi.fn(async () => []),
    deletePermanently: vi.fn(async () => undefined),
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
vi.mock('@/features/treatments/services/treatmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/treatments/services/treatmentService')>()),
  treatmentService: { list: vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 50 })) },
}))
vi.mock('@/features/auth/services/userService', () => ({ userService: { getPreferences: vi.fn(async () => ({ timeFormat: '24h' })) } }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

const renderPage = (roles: string[]) => {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles })
  return renderWithProviders(
    <Routes>
      <Route path="/patients/:id" element={<PatientDetailPage />} />
      <Route path="/patients" element={<Where />} />
    </Routes>,
    { route: '/patients/p1' },
  )
}

// User request 2026-11-13: the Administrator can delete a patient for good, with everything
describe('PatientDetailPage permanent delete', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('deletes the patient for good once their name is typed, and goes back to the list', async () => {
    const user = userEvent.setup()
    renderPage(['ClinicOwner'])

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: /type lejla hasanović to confirm/i }), 'Lejla Hasanović')
    await user.click(confirm)

    await waitFor(() => expect(patientService.deletePermanently).toHaveBeenCalledWith('p1'))
    expect(await screen.findByTestId('where')).toHaveTextContent('/patients')
  })

  it('is not offered to the staff', async () => {
    renderPage(['Staff'])

    await screen.findByRole('heading', { name: 'Lejla Hasanović' })
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument()
  })
})
