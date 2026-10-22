import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
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
  appointmentService: { list: vi.fn(pending) },
}))

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
