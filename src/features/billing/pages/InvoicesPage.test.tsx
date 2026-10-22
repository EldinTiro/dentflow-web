import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { InvoicesPage } from './InvoicesPage'

vi.mock('../services/billingService', async (orig) => ({
  ...(await orig<typeof import('../services/billingService')>()),
  billingService: {
    list: vi.fn(async () => ({
      items: [
        {
          id: 'i1', patientId: 'p1', patientName: 'Selma Aganović', invoiceNumber: 'INV-20261022-0001',
          status: 'Sent', issuedAt: '2026-09-01T08:00:00Z', dueDate: '2026-10-01T00:00:00Z',
          subTotal: 50, paidAmount: 0, balanceDue: 50, lineItemCount: 1, createdAt: '2026-09-01T08:00:00Z', isOverdue: true,
        },
      ],
      totalCount: 1, page: 1, pageSize: 20,
    })),
  },
}))

describe('InvoicesPage', () => {
  // QA-025: no patient column, and overdue invoices looked like current ones
  it('shows the patient and marks overdue invoices', async () => {
    renderWithProviders(<InvoicesPage />)

    const row = (await screen.findByText('INV-20261022-0001')).closest('tr') as HTMLElement
    expect(within(row).getByText('Selma Aganović')).toBeInTheDocument()
    expect(within(row).getByText('Overdue')).toBeInTheDocument()
  })

  // QA-032: US dates and amounts without a currency
  it('shows day-first dates and amounts in KM', async () => {
    renderWithProviders(<InvoicesPage />)

    const row = (await screen.findByText('INV-20261022-0001')).closest('tr') as HTMLElement
    expect(within(row).getByText('01/09/2026')).toBeInTheDocument()
    expect(within(row).getAllByText('50.00 KM').length).toBeGreaterThan(0)
  })
})
