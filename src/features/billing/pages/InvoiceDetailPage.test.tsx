import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { invoiceFixture } from '@/test/fixtures/invoice'
import { fastEndpointsError } from '@/test/render'
import { InvoiceDetailPage } from './InvoiceDetailPage'
import { billingService } from '../services/billingService'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { useAuthStore } from '@/features/auth/store/authStore'

vi.mock('../services/billingService', async (orig) => {
  const actual = await orig<typeof import('../services/billingService')>()
  return {
    ...actual,
    billingService: { ...actual.billingService, getById: vi.fn(), voidInvoice: vi.fn(), addLineItem: vi.fn(), update: vi.fn() },
  }
})
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: { getById: vi.fn(() => new Promise(() => {})) },
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { listTypes: vi.fn(async () => []) },
}))

function renderInvoice(status: 'Paid' | 'PartiallyPaid' | 'Draft', extra: Parameters<typeof invoiceFixture>[0] = {}) {
  vi.mocked(billingService.getById).mockResolvedValue(
    invoiceFixture({
      status,
      paidAmount: status === 'Paid' ? 75 : status === 'PartiallyPaid' ? 30 : 0,
      balanceDue: status === 'Paid' ? 0 : status === 'PartiallyPaid' ? 45 : 75,
      ...extra,
    }),
  )
  renderWithProviders(
    <Routes>
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { route: '/invoices/inv-1' },
  )
}

const addRow = () => screen.getByRole('group', { name: 'Add an item' })

describe('InvoiceDetailPage line items', () => {
  // QA-004: a paid invoice still offered + Add Line Item / Edit / Delete
  it('locks line items on a paid invoice', async () => {
    renderInvoice('Paid')

    await screen.findByText('Filling')
    expect(screen.queryByRole('group', { name: 'Add an item' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions for Filling' })).not.toBeInTheDocument()
  })

  it('keeps line items editable on a partially paid invoice', async () => {
    renderInvoice('PartiallyPaid')

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Filling' }))

    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
    expect(addRow()).toBeInTheDocument()
  })
})

// User request 2026-11-12: add items on the page itself, from the price list, no pop-up
describe('InvoiceDetailPage adding an item', () => {
  beforeEach(() => {
    vi.mocked(billingService.addLineItem).mockReset().mockResolvedValue(invoiceFixture())
    vi.mocked(appointmentService.listTypes).mockResolvedValue([
      { id: 't1', name: 'Rendgen snimak', defaultFee: 20 },
      { id: 't2', name: 'Kontrola', defaultFee: null },
    ] as never)
  })

  it('adds a service from the price list with its price', async () => {
    renderInvoice('Draft')
    await screen.findByText('Filling')

    await userEvent.type(within(addRow()).getByRole('combobox', { name: 'Service' }), 'rend')
    await userEvent.click(await screen.findByRole('option', { name: /Rendgen snimak/ }))
    expect(within(addRow()).getByRole('spinbutton', { name: 'Price' })).toHaveValue(20)
    await userEvent.clear(within(addRow()).getByRole('spinbutton', { name: 'Quantity' }))
    await userEvent.type(within(addRow()).getByRole('spinbutton', { name: 'Quantity' }), '2')
    await userEvent.click(within(addRow()).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(billingService.addLineItem).toHaveBeenCalledWith('inv-1', expect.objectContaining({
      description: 'Rendgen snimak', quantity: 2, unitFee: 20,
    })))
  })

  it('adds anything typed, with a price entered by hand', async () => {
    renderInvoice('Draft')
    await screen.findByText('Filling')

    await userEvent.type(within(addRow()).getByRole('combobox', { name: 'Service' }), 'Izbjeljivanje')
    await userEvent.type(within(addRow()).getByRole('spinbutton', { name: 'Price' }), '150')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(billingService.addLineItem).toHaveBeenCalledWith('inv-1', expect.objectContaining({
      description: 'Izbjeljivanje', quantity: 1, unitFee: 150,
    })))
  })

  it('does not add an item without a description', async () => {
    renderInvoice('Draft')
    await screen.findByText('Filling')

    await userEvent.click(within(addRow()).getByRole('button', { name: 'Add' }))

    expect(billingService.addLineItem).not.toHaveBeenCalled()
  })
})

describe('InvoiceDetailPage totals and payment', () => {
  it('sums up in one place with the payment button', async () => {
    renderInvoice('PartiallyPaid')

    const totals = await screen.findByRole('region', { name: 'Totals' })
    expect(totals).toHaveTextContent('75.00 KM')
    expect(totals).toHaveTextContent('30.00 KM')
    expect(totals).toHaveTextContent('45.00 KM')
    expect(within(totals).getByRole('button', { name: 'Record Payment' })).toBeInTheDocument()
  })

  it('offers no payment once the invoice is paid', async () => {
    renderInvoice('Paid')

    await screen.findByRole('region', { name: 'Totals' })
    expect(screen.queryByRole('button', { name: 'Record Payment' })).not.toBeInTheDocument()
  })
})

describe('InvoiceDetailPage notes', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('lets the owner write a note on the page', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'O', roles: ['ClinicOwner'] })
    vi.mocked(billingService.update).mockResolvedValue(invoiceFixture({ notes: 'Plaća u dvije rate' }))
    renderInvoice('Draft')

    await userEvent.click(await screen.findByRole('button', { name: 'Add a note' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'Plaća u dvije rate')
    await userEvent.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(billingService.update).toHaveBeenCalledWith('inv-1', { dueDate: null, notes: 'Plaća u dvije rate' }))
  })

  // The API lets only finance.adjust change invoice metadata
  it('shows the note to the staff without editing', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 's@x', fullName: 'S', roles: ['Staff'] })
    renderInvoice('Draft', { notes: 'Plaća u dvije rate' })

    expect(await screen.findByText('Plaća u dvije rate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit note' })).not.toBeInTheDocument()
  })
})

describe('InvoiceDetailPage void', () => {
  // QA-036: after a failed Void the confirm dialog stayed open
  it('closes the confirm dialog when voiding fails', async () => {
    vi.mocked(billingService.voidInvoice).mockRejectedValue(fastEndpointsError('Cannot void a fully paid invoice.'))
    renderInvoice('Draft')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Void Invoice' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /void/i }))

    await waitFor(() => expect(billingService.voidInvoice).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('InvoiceDetailPage back link', () => {
  // The clinic-wide invoice list is finance.view; a receptionist who opened the invoice
  // from a patient was sent back to an "access denied" page
  it.each([
    ['ClinicOwner', '/finance/invoices'],
    ['Staff', '/patients/pat-1?tab=billing'],
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

    await userEvent.click(await screen.findByRole('button', { name: 'More' }))
    const voidItem = screen.getByRole('menuitem', { name: 'Void Invoice' })
    expect(voidItem).toBeDisabled()
    expect(voidItem).toHaveAttribute('title', expect.stringMatching(/payment/i))
  })

  it('allows Void on an invoice with no payment', async () => {
    renderInvoice('Draft')

    await userEvent.click(await screen.findByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitem', { name: 'Void Invoice' })).toBeEnabled()
  })
})
