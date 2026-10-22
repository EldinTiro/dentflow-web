import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { DashboardPage } from './DashboardPage'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { patientService } from '@/features/patients/services/patientService'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 1 }) }))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []) },
}))
vi.mock('@/features/patients/services/patientService', () => ({ patientService: { list: vi.fn(empty) } }))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))
vi.mock('./dashboardService', () => ({ dashboardService: { getStats: vi.fn(() => new Promise(() => {})) } }))
vi.mock('./SlotCheckerWidget', () => ({ SlotCheckerWidget: () => null }))

describe('DashboardPage', () => {
  afterEach(() => vi.useRealTimers())

  // QA-035: "Pending Confirmation" = 180 — every Scheduled visit ever, past ones included
  it('counts only upcoming scheduled appointments as pending confirmation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'))
    renderWithProviders(<DashboardPage />)

    await waitFor(() =>
      expect(appointmentService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Scheduled', dateFrom: '2026-10-22' }),
      ),
    )
  })

  // QA-033: the dashboard downloaded 500 patients just to label today's appointments
  it('does not download the whole patient list', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => expect(appointmentService.list).toHaveBeenCalled())
    expect(patientService.list).not.toHaveBeenCalledWith(expect.objectContaining({ pageSize: 500 }))
  })
})
