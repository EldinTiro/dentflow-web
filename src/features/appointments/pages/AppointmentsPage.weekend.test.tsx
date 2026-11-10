import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router'
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
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))
// Mon–Fri open, Saturday and Sunday closed
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: { getSettings: vi.fn(async () => ({ weeklyScheduleJson: JSON.stringify(DEFAULT_WEEKLY_SCHEDULE) })) },
}))

function renderWeek() {
  return renderWithProviders(
    <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
    { route: '/appointments?from=2026-11-09' },
  )
}

// User request 2026-11-10: no Saturday and Sunday in the week when the clinic is closed then
describe('AppointmentsPage week and closed days', () => {
  beforeEach(() => { vi.mocked(appointmentService.list).mockImplementation(empty) })

  it('leaves out the days the clinic is closed', async () => {
    renderWeek()

    expect(await screen.findByText('Friday')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByText('Saturday')).toBeNull())
    expect(screen.queryByText('Sunday')).toBeNull()
  })

  it('still shows a closed day that has a visit booked on it', async () => {
    const saturday = appointmentFixture({
      id: 'sat', status: 'Scheduled', durationMinutes: 30,
      startAt: new Date(2026, 10, 14, 9, 0).toISOString(), endAt: new Date(2026, 10, 14, 9, 30).toISOString(),
    })
    vi.mocked(appointmentService.list).mockResolvedValue({ items: [saturday], totalCount: 1, page: 1, pageSize: 200 } as never)
    renderWeek()

    expect(await screen.findByText('Saturday')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByText('Sunday')).toBeNull())
  })
})
