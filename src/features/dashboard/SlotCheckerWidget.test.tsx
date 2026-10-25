import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { SlotCheckerWidget } from './SlotCheckerWidget'

vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: { getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })) },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'p1', fullName: 'Eldina Muhić', isBookable: true },
        { id: 'p2', fullName: 'Ana Rozić', isBookable: true },
      ],
      totalCount: 2, page: 1, pageSize: 50,
    })),
  },
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: {
    list: vi.fn(async () => ({
      items: [
        // Eldina 08:30–09:30, Ana 13:30–14:00 — never both at once
        { id: 'a1', providerId: 'p1', status: 'Scheduled', startAt: '2026-10-26T08:30:00', endAt: '2026-10-26T09:30:00' },
        { id: 'a2', providerId: 'p2', status: 'Scheduled', startAt: '2026-10-26T13:30:00', endAt: '2026-10-26T14:00:00' },
      ],
      totalCount: 2, page: 1, pageSize: 200,
    })),
  },
}))

describe('SlotCheckerWidget — all providers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T07:00:00')) // a Monday; default schedule 08:00–17:00
  })
  afterEach(() => vi.useRealTimers())

  // User report: "Svi doktori" showed 19 free · 0 booked while two doctors had visits
  it('marks slots where only some doctors are busy as partly booked', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await vi.waitFor(() => expect(screen.getByRole('link', { name: /08:30/ })).toHaveAttribute('data-state', 'partial'))
    const slot0830 = screen.getByRole('link', { name: /08:30/ })
    expect(slot0830).toHaveTextContent('1/2')
    expect(slot0830).toHaveAttribute('title', expect.stringContaining('Eldina Muhić'))
    expect(screen.getByRole('link', { name: /^08:00/ })).toHaveAttribute('data-state', 'free')

    expect(await screen.findByText('16 free')).toBeInTheDocument()
    expect(screen.getByText('3 partly booked')).toBeInTheDocument()
    expect(screen.getByText('0 booked')).toBeInTheDocument()
  })

  // Booking from a partly booked slot goes to the doctor who is actually free
  it('books a partly booked slot with the free doctor', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    await vi.waitFor(() => expect(screen.getByRole('link', { name: /13:30/ })).toHaveAttribute('data-free-provider', 'p1'))
  })

  it('shows the opening hours without doubled minutes', async () => {
    renderWithProviders(<SlotCheckerWidget />)

    expect(await screen.findByText(/08:00 – 17:00/)).toBeInTheDocument()
    expect(screen.queryByText(/08:00:00/)).not.toBeInTheDocument()
  })
})
