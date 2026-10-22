import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { invoiceFixture } from '@/test/fixtures/invoice'
import { fastEndpointsError } from '@/test/render'
import { InvoiceDetailPage } from './InvoiceDetailPage'
import { billingService } from '../services/billingService'

vi.mock('../services/billingService', async (orig) => {
  const actual = await orig<typeof import('../services/billingService')>()
  return { ...actual, billingService: { ...actual.billingService, getById: vi.fn(), voidInvoice: vi.fn() } }
})
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: { getById: vi.fn(() => new Promise(() => {})) },
}))

function renderInvoice(status: 'Paid' | 'PartiallyPaid' | 'Draft') {
  vi.mocked(billingService.getById).mockResolvedValue(
    invoiceFixture({ status, paidAmount: status === 'Paid' ? 75 : 30, balanceDue: status === 'Paid' ? 0 : 45 }),
  )
  renderWithProviders(
    <Routes>
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { route: '/invoices/inv-1' },
  )
}

describe('InvoiceDetailPage line items', () => {
  // QA-004: a paid invoice still offered + Add Line Item / Edit / Delete
  it('locks line items on a paid invoice', async () => {
    renderInvoice('Paid')

    expect(await screen.findByRole('button', { name: /add line item/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('keeps line items editable on a partially paid invoice', async () => {
    renderInvoice('PartiallyPaid')

    expect(await screen.findByRole('button', { name: /add line item/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })
})

describe('InvoiceDetailPage void', () => {
  // QA-036: after a failed Void the confirm dialog stayed open
  it('closes the confirm dialog when voiding fails', async () => {
    vi.mocked(billingService.voidInvoice).mockRejectedValue(fastEndpointsError('Cannot void a fully paid invoice.'))
    renderInvoice('Draft')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Void Invoice' }))
    await user.click(screen.getAllByRole('button', { name: /void/i }).at(-1)!)

    await waitFor(() => expect(billingService.voidInvoice).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
