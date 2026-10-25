import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { AppointmentsPage } from './AppointmentsPage'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 }) }))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

describe('AppointmentsPage view toggle', () => {
  // Clinics plan their day on the calendar, so that is where the page opens
  it('opens on the calendar', () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
    )

    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  })

  // QA-029: the toggle kept one view highlighted while the other was shown
  it('marks the view that is actually shown, and keeps the list in the URL', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
      { route: '/appointments' },
    )
    const list = screen.getByRole('button', { name: 'List' })
    const calendar = screen.getByRole('button', { name: 'Calendar' })

    await userEvent.click(list)

    expect(list).toHaveAttribute('aria-pressed', 'true')
    expect(calendar).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('location')).toHaveTextContent('tab=list')
  })
})

describe('AppointmentsPage filters', () => {
  // DR-36: the filter controls had no accessible name at all
  it('gives every filter control an accessible name', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?tab=list' },
    )

    expect(screen.getByRole('textbox', { name: 'Search appointments' })).toBeInTheDocument()
    expect(screen.getByLabelText('From date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('To date')).toHaveAttribute('type', 'date')
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Provider' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show past' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Search appointments' }), 'x')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })
})

describe('AppointmentsPage provider names', () => {
  // People-merge plan B6: GET /staff is active-only by default, but past appointments
  // of a deactivated dentist must still show their name
  it('loads every staff member, inactive ones included', async () => {
    const { staffService } = await import('@/features/staff/services/staffService')
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
    )

    await vi.waitFor(() => expect(staffService.list).toHaveBeenCalledWith(expect.objectContaining({ isActive: 'all' })))
  })
})
