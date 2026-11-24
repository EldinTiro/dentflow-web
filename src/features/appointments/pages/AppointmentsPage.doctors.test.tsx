import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { AppointmentsPage } from './AppointmentsPage'
import { appointmentService } from '../services/appointmentService'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 }) }))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'p1', fullName: 'Ana Rozić', colorHex: '#ef4444', isActive: true, isBookable: true },
        { id: 'p2', fullName: 'Eldina Muhić', colorHex: '#3b82f6', isActive: true, isBookable: true },
        { id: 'r', fullName: 'Desk Person', colorHex: null, isActive: true, isBookable: false },
      ],
      totalCount: 3, page: 1, pageSize: 100,
    })),
    listClinicAbsences: vi.fn(async () => []),
  },
}))

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
    { route },
  )
}

const visits = [
  appointmentFixture({
    id: 'a', providerId: 'p1', patientId: 'pa', patientName: 'Ana Patient', status: 'Scheduled', durationMinutes: 30,
    startAt: new Date(2026, 11, 16, 9, 0).toISOString(), endAt: new Date(2026, 11, 16, 9, 30).toISOString(),
  } as never),
  appointmentFixture({
    id: 'b', providerId: 'p2', patientId: 'pb', patientName: 'Eldina Patient', status: 'Scheduled', durationMinutes: 30,
    startAt: new Date(2026, 11, 16, 10, 0).toISOString(), endAt: new Date(2026, 11, 16, 10, 30).toISOString(),
  } as never),
]

// User request 2026-11-10: click a doctor's name to see only their visits (no dropdown)
describe('AppointmentsPage doctor filter', () => {
  beforeEach(() => {
    vi.mocked(appointmentService.list).mockResolvedValue({ items: visits, totalCount: 2, page: 1, pageSize: 200 } as never)
  })

  it('offers a button per bookable doctor, all shown at first', async () => {
    renderPage('/appointments?from=2026-12-16')

    expect(await screen.findByRole('button', { name: 'Ana Rozić' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Eldina Muhić' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'All doctors' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Desk Person' })).toBeNull()
    expect(await screen.findByText(/Ana Patient/)).toBeInTheDocument()
    expect(screen.getByText(/Eldina Patient/)).toBeInTheDocument()
  })

  it("shows only a clicked doctor's visits in the week, and remembers it in the link", async () => {
    renderPage('/appointments?from=2026-12-16')

    await userEvent.click(await screen.findByRole('button', { name: 'Ana Rozić' }))

    expect(screen.getByRole('button', { name: 'Ana Rozić' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All doctors' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Ana Patient/)).toBeInTheDocument()
    expect(screen.queryByText(/Eldina Patient/)).toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('doctors=p1')
  })

  it('takes several doctors, and all again from "All doctors"', async () => {
    renderPage('/appointments?from=2026-12-16')

    await userEvent.click(await screen.findByRole('button', { name: 'Ana Rozić' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eldina Muhić' }))
    expect(screen.getByText(/Ana Patient/)).toBeInTheDocument()
    expect(screen.getByText(/Eldina Patient/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Eldina Muhić' }))
    expect(screen.queryByText(/Eldina Patient/)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'All doctors' }))
    expect(screen.getByText(/Eldina Patient/)).toBeInTheDocument()
    expect(screen.getByTestId('location')).not.toHaveTextContent('doctors=')
  })

  it("keeps only the chosen doctors' columns in the day view", async () => {
    renderPage('/appointments?view=day&day=2026-12-16&doctors=p2')

    expect(await screen.findByText(/Eldina Patient/)).toBeInTheDocument()
    expect(screen.queryByText(/Ana Patient/)).toBeNull()
  })

  it("counts only the chosen doctors' visits in the month", async () => {
    renderPage('/appointments?view=month&month=2026-12&doctors=p1')

    expect(await screen.findByRole('button', { name: '16 December 2026, 1 visit' })).toBeInTheDocument()
  })
})
