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
})
