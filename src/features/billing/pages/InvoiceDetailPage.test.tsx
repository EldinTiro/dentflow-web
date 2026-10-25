import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { invoiceFixture } from '@/test/fixtures/invoice'
import { fastEndpointsError } from '@/test/render'
import { InvoiceDetailPage } from './InvoiceDetailPage'
import { billingService } from '../services/billingService'
import { useAuthStore } from '@/features/auth/store/authStore'

vi.mock('../services/billingService', async (orig) => {
  const actual = await orig<typeof import('../services/billingService')>()
  return { ...actual, billingService: { ...actual.billingService, getById: vi.fn(), voidInvoice: vi.fn() } }
})
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: { getById: vi.fn(() => new Promise(() => {})) },
}))

function renderInvoice(status: 'Paid' | 'PartiallyPaid' | 'Draft') {
  vi.mocked(billingService.getById).mockResolvedValue(
    invoiceFixture({
      status,
      paidAmount: status === 'Paid' ? 75 : status === 'PartiallyPaid' ? 30 : 0,
      balanceDue: status === 'Paid' ? 0 : status === 'PartiallyPaid' ? 45 : 75,
    }),
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

describe('InvoiceDetailPage back link', () => {
  // The clinic-wide invoice list is finance.view; a receptionist who opened the invoice
  // from a patient was sent back to an "access denied" page
  it.each([
    ['ClinicOwner', '/finance/invoices'],
    ['Receptionist', '/patients/pat-1?tab=billing'],
  ])('goes back somewhere a %s may open', async (role, href) => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'x@x', fullName: 'X', roles: [role] })
    renderInvoice('Draft')

    expect(await screen.findByRole('link', { name: /back to/i })).toHaveAttribute('href', href)
    useAuthStore.getState().clearAuth()
  })
})

// DT-35 / DT-03: Void stayed enabled on paid invoices and always failed; a part-paid one
// could be voided and its payment stayed in revenue. Only an invoice with no payment.
describe('InvoiceDetailPage void rules', () => {
  it.each(['Paid', 'PartiallyPaid'] as const)('disables Void on a %s invoice and says why', async (status) => {
    renderInvoice(status)

    const voidButton = await screen.findByRole('button', { name: 'Void Invoice' })
    expect(voidButton).toBeDisabled()
    expect(voidButton).toHaveAttribute('title', expect.stringMatching(/payment/i))
  })

  it('allows Void on an invoice with no payment', async () => {
    renderInvoice('Draft')

    expect(await screen.findByRole('button', { name: 'Void Invoice' })).toBeEnabled()
  })
})
