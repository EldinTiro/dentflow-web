import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { PatientDetailPage } from './PatientDetailPage'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: {
    getById: vi.fn(async () => ({
      id: 'p1', patientNumber: 'P-1', firstName: 'Selma', lastName: 'Aganović', fullName: 'Selma Aganović',
      status: 'Active', preferredName: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: null,
    })),
    listAllergies: vi.fn(async () => []),
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

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

describe('PatientDetailPage tabs', () => {
  // QA-028: tabs were plain buttons, and the active tab was lost on reload
  it('exposes the tabs as tabs and keeps the active one in the URL', async () => {
    renderWithProviders(
      <Routes><Route path="/patients/:id" element={<><PatientDetailPage /><Location /></>} /></Routes>,
      { route: '/patients/p1?tab=medical' },
    )

    const medical = await screen.findByRole('tab', { name: /medical/i })
    expect(medical).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: /appointments/i }))

    expect(screen.getByRole('tab', { name: /appointments/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('tab=appointments')
  })

  // QA-020: the overview rendered the raw key "field.email"
  it('labels the email field', async () => {
    renderWithProviders(
      <Routes><Route path="/patients/:id" element={<PatientDetailPage />} /></Routes>,
      { route: '/patients/p1' },
    )
    expect(await screen.findByText('Email')).toBeInTheDocument()
    expect(screen.queryByText('field.email')).not.toBeInTheDocument()
  })

})

describe('PatientDetailPage booking', () => {
  // UX Phase A: there was no way to book from a patient — reception had to go to
  // Appointments and search for the same patient again
  it('books an appointment for this patient with the patient already selected', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Rec', roles: ['Receptionist'] })
    renderWithProviders(
      <Routes><Route path="/patients/:id" element={<PatientDetailPage />} /></Routes>,
      { route: '/patients/p1' },
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Book appointment' }))

    const drawer = await screen.findByRole('heading', { name: 'Book Appointment' })
    expect(drawer).toBeInTheDocument()
    expect(screen.getAllByText('Selma Aganović').length).toBeGreaterThan(1) // page header + drawer
    expect(screen.queryByPlaceholderText(/name, phone or chart number/i)).not.toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })
})
