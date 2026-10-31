import type { InvoiceResponse } from '@/features/billing/services/billingService'

export function invoiceFixture(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: 'inv-1',
    patientId: 'pat-1',
    invoiceNumber: 'INV-20261022-0001',
    status: 'Draft',
    issuedAt: '2026-10-22T08:00:00Z',
    dueDate: null,
    notes: null,
    appointmentId: null,
    subTotal: 75,
    paidAmount: 0,
    balanceDue: 75,
    lineItems: [
      {
        id: 'li-1', invoiceId: 'inv-1', description: 'Filling', cdtCode: null, toothNumber: null,
        quantity: 1, unitFee: 75, lineTotal: 75, treatmentPlanItemId: null,
      },
    ],
    payments: [],
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: null,
    ...overrides,
  }
}
