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
})
