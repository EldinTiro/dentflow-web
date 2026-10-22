import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { AppointmentsPage } from './AppointmentsPage'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 }) }))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))

describe('AppointmentsPage view toggle', () => {
  // QA-029: the toggle kept "List" highlighted while the calendar was shown
  it('marks the view that is actually shown', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
    )
    const list = screen.getByRole('button', { name: 'List' })
    const calendar = screen.getByRole('button', { name: 'Calendar' })
    expect(list).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(calendar)

    expect(calendar).toHaveAttribute('aria-pressed', 'true')
    expect(list).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('AppointmentsPage filters', () => {
  // DR-36: the filter controls had no accessible name at all
  it('gives every filter control an accessible name', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
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
