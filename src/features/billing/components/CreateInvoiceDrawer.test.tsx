import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { CreateInvoiceDrawer } from './CreateInvoiceDrawer'
import { billingService } from '../services/billingService'

vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { listTypes: vi.fn(async () => []) },
}))
vi.mock('../services/billingService', async (orig) => ({
  ...(await orig<typeof import('../services/billingService')>()),
  billingService: { create: vi.fn() },
}))

describe('CreateInvoiceDrawer', () => {
  // QA-036: an empty line-item description blocked submit without saying why
  it('says the description is required', async () => {
    renderWithProviders(<CreateInvoiceDrawer patientId="p1" onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(billingService.create).not.toHaveBeenCalled()
  })

  // The appointment panel bills a visit once: the invoice has to say which visit it bills
  it('sends the appointment it bills', async () => {
    vi.mocked(billingService.create).mockResolvedValue({ id: 'inv-1' } as never)
    const { container } = renderWithProviders(<CreateInvoiceDrawer patientId="p1" appointmentId="appt-1" onClose={() => {}} />)

    await userEvent.type(container.querySelector<HTMLInputElement>('input[name="lineItems.0.description"]')!, 'Extraction')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(billingService.create).toHaveBeenCalledWith('p1', expect.objectContaining({ appointmentId: 'appt-1' }))
  })
})
