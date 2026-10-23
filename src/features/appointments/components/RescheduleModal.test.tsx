import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { RescheduleModal } from './RescheduleModal'
import { appointmentService } from '../services/appointmentService'

vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { reschedule: vi.fn() },
}))

describe('RescheduleModal', () => {
  // Same stale-calendar bug as booking: a moved visit stayed in its old slot on the calendar
  it('refreshes the calendar week after moving a visit', async () => {
    vi.mocked(appointmentService.reschedule).mockResolvedValue({} as Awaited<ReturnType<typeof appointmentService.reschedule>>)
    const { queryClient } = renderWithProviders(<RescheduleModal appointment={appointmentFixture()} onClose={() => {}} />)
    queryClient.setQueryData(['appointments-week', '2026-10-19'], { items: [] })

    await userEvent.click(screen.getByRole('button', { name: 'Reschedule' }))

    await vi.waitFor(() => expect(appointmentService.reschedule).toHaveBeenCalled())
    await vi.waitFor(() => expect(queryClient.getQueryState(['appointments-week', '2026-10-19'])?.isInvalidated).toBe(true))
  })
})
