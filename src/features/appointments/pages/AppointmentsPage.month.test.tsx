import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { AppointmentsPage } from './AppointmentsPage'
import { appointmentService } from '../services/appointmentService'
import { DEFAULT_WEEKLY_SCHEDULE } from '@/shared/lib/clinicSchedule'

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
      ],
      totalCount: 2, page: 1, pageSize: 100,
    })),
  },
}))
// Mon–Fri open, Saturday and Sunday closed
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: { getSettings: vi.fn(async () => ({ weeklyScheduleJson: JSON.stringify(DEFAULT_WEEKLY_SCHEDULE) })) },
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

const visit = (id: string, providerId: string, y: number, m: number, d: number, h: number) => appointmentFixture({
  id, providerId, status: 'Scheduled', durationMinutes: 30,
  startAt: new Date(y, m, d, h, 0).toISOString(), endAt: new Date(y, m, d, h, 30).toISOString(),
})

const page = (items: unknown[], totalCount = items.length) => ({ items, totalCount, page: 1, pageSize: 200 }) as never

// User request 2026-11-10: a month view to look ahead, with how busy each day is
describe('AppointmentsPage month view', () => {
  beforeEach(() => { vi.mocked(appointmentService.list).mockImplementation(empty) })

  it('switches from the week to the month it is in', async () => {
    renderPage('/appointments?from=2026-12-16')

    await userEvent.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent('view=month')
    expect(screen.getByTestId('location')).toHaveTextContent('month=2026-12')
    expect(screen.getByRole('button', { name: 'December 2026' })).toBeInTheDocument()
  })

  it('shows how many visits each day has, and with which doctors', async () => {
    vi.mocked(appointmentService.list).mockResolvedValue(page([
      visit('a', 'p1', 2026, 11, 17, 9), visit('b', 'p1', 2026, 11, 17, 10), visit('c', 'p2', 2026, 11, 17, 11),
    ]))
    renderPage('/appointments?view=month&month=2026-12')

    const day = await screen.findByRole('button', { name: '17 December 2026, 3 visits' })
    expect(within(day).getByTitle('Ana Rozić: 2')).toBeInTheDocument()
    expect(within(day).getByTitle('Eldina Muhić: 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '16 December 2026, 0 visits' })).toBeInTheDocument()
  })

  it('leaves cancelled visits out of the count', async () => {
    vi.mocked(appointmentService.list).mockResolvedValue(page([
      visit('a', 'p1', 2026, 11, 17, 9), { ...visit('b', 'p1', 2026, 11, 17, 10), status: 'Cancelled' },
    ]))
    renderPage('/appointments?view=month&month=2026-12')

    expect(await screen.findByRole('button', { name: '17 December 2026, 1 visit' })).toBeInTheDocument()
  })

  it('opens the day view on a clicked day', async () => {
    renderPage('/appointments?view=month&month=2026-12')

    await userEvent.click(await screen.findByRole('button', { name: '17 December 2026, 0 visits' }))

    expect(screen.getByTestId('location')).toHaveTextContent('view=day')
    expect(screen.getByTestId('location')).toHaveTextContent('day=2026-12-17')
  })

  it('pages months with its arrows', async () => {
    renderPage('/appointments?view=month&month=2026-12')

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByTestId('location')).toHaveTextContent('month=2027-01')

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByTestId('location')).toHaveTextContent('month=2026-11')
  })

  // The API returns at most 200 visits a page; a busy clinic has more in a month
  it('loads every page of the month', async () => {
    vi.mocked(appointmentService.list).mockImplementation(async (params) =>
      page((params as { page?: number }).page === 2 ? [visit('z', 'p1', 2026, 11, 18, 9)] : [visit('a', 'p1', 2026, 11, 17, 9)], 201))
    renderPage('/appointments?view=month&month=2026-12')

    expect(await screen.findByRole('button', { name: '18 December 2026, 1 visit' })).toBeInTheDocument()
  })

  it('leaves out the weekdays the clinic is closed', async () => {
    renderPage('/appointments?view=month&month=2026-12')

    expect(await screen.findByRole('button', { name: '18 December 2026, 0 visits' })).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /^19 December 2026/ })).toBeNull())
  })

  it('goes back to the week of the 1st', async () => {
    renderPage('/appointments?view=month&month=2026-12')

    await userEvent.click(screen.getByRole('button', { name: 'Week' }))

    expect(screen.getByText('30 Nov – 6 Dec 2026')).toBeInTheDocument()
  })
})
