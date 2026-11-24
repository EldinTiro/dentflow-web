import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { renderWithProviders } from '@/test/render'
import { RecordPaymentModal } from './RecordPaymentModal'
import { billingService } from '../services/billingService'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/billingService', async (orig) => {
  const actual = await orig<typeof import('../services/billingService')>()
  return { ...actual, billingService: { ...actual.billingService, recordPayment: vi.fn() } }
})

describe('RecordPaymentModal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // QA-009: at 01:11 local the default "today" was sent as local noon — in the future
  it('sends a "today" payment as the current instant, never in the future', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T23:11:00Z')) // 22 Oct 01:11 in Sarajevo
    vi.mocked(billingService.recordPayment).mockResolvedValue({} as never)
    renderWithProviders(<RecordPaymentModal invoiceId="inv-1" balanceDue={75} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(billingService.recordPayment).toHaveBeenCalled())
    const body = vi.mocked(billingService.recordPayment).mock.calls[0][1]
    expect(new Date(body.paidAt).getTime()).toBeLessThanOrEqual(Date.now())
    expect(body.paidAt).toBe('2026-10-21T23:11:00.000Z')
  })

  // QA-036: the success toast just repeated the button label "Record Payment"
  it('confirms with a real message', async () => {
    vi.mocked(billingService.recordPayment).mockResolvedValue({} as never)
    renderWithProviders(<RecordPaymentModal invoiceId="inv-1" balanceDue={75} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Payment recorded.'))
  })

  // User report 2026-11-12: after paying, the patient's page still showed a balance of
  // 22 KM until reloaded; the patient's cached balance and timeline were not refreshed
  it("refreshes the patient's balance and timeline, and the patient list", async () => {
    vi.mocked(billingService.recordPayment).mockResolvedValue({} as never)
    const { queryClient } = renderWithProviders(<RecordPaymentModal invoiceId="inv-1" balanceDue={75} onClose={() => {}} />)
    queryClient.setQueryData(['patient', 'pat-1'], { balance: 22 })
    queryClient.setQueryData(['patient-timeline', 'pat-1'], [])
    queryClient.setQueryData(['patients', { page: 1 }], { items: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(queryClient.getQueryState(['patient', 'pat-1'])?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(['patient-timeline', 'pat-1'])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['patients', { page: 1 }])?.isInvalidated).toBe(true)
  })
})
