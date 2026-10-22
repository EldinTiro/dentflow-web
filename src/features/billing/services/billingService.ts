import apiClient from '@/shared/api/client'
import { localDayStartUtc, localDayEndUtc } from '@/shared/lib/dates'

export type InvoiceStatus = 'Draft' | 'Sent' | 'PartiallyPaid' | 'Paid' | 'Void'
export type PaymentMethod = 'Cash' | 'Card' | 'Insurance' | 'BankTransfer' | 'Other'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft: 'Draft',
  Sent: 'Sent',
  PartiallyPaid: 'Partially Paid',
  Paid: 'Paid',
  Void: 'Void',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300',
  Paid: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  Void: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300',
}

export interface InvoiceLineItemResponse {
  id: string
  invoiceId: string
  description: string
  cdtCode: string | null
  toothNumber: number | null
  quantity: number
  unitFee: number
  lineTotal: number
  treatmentPlanItemId: string | null
}

export interface InvoicePaymentResponse {
  id: string
  invoiceId: string
  amount: number
  method: PaymentMethod
  paidAt: string
  reference: string | null
  notes: string | null
}

export interface InvoiceResponse {
  id: string
  patientId: string
  invoiceNumber: string
  status: InvoiceStatus
  issuedAt: string
  dueDate: string | null
  notes: string | null
  subTotal: number
  paidAmount: number
  balanceDue: number
  lineItems: InvoiceLineItemResponse[]
  payments: InvoicePaymentResponse[]
  createdAt: string
  updatedAt: string | null
}

export interface InvoiceSummaryResponse {
  id: string
  patientId: string
  invoiceNumber: string
  status: InvoiceStatus
  issuedAt: string
  dueDate: string | null
  subTotal: number
  paidAmount: number
  balanceDue: number
  lineItemCount: number
  createdAt: string
  patientName: string | null
  /** Past the due date with a balance left (QA-025). */
  isOverdue: boolean
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface CreateLineItemInput {
  description: string
  cdtCode?: string | null
  toothNumber?: number | null
  quantity: number
  unitFee: number
}

export interface CreateInvoiceRequest {
  dueDate?: string | null
  notes?: string | null
  lineItems: CreateLineItemInput[]
}

export interface UpdateInvoiceRequest {
  dueDate?: string | null
  notes?: string | null
}

export interface AddLineItemRequest {
  description: string
  cdtCode?: string | null
  toothNumber?: number | null
  quantity: number
  unitFee: number
}

export interface UpdateLineItemRequest {
  description: string
  cdtCode?: string | null
  toothNumber?: number | null
  quantity: number
  unitFee: number
}

export interface RecordPaymentRequest {
  amount: number
  method: PaymentMethod
  paidAt: string
  reference?: string | null
  notes?: string | null
}

export const billingService = {
  list: (params?: {
    status?: InvoiceStatus | ''
    from?: string // local calendar date, YYYY-MM-DD
    to?: string
    page?: number
    pageSize?: number
  }) =>
    apiClient
      .get<PagedResult<InvoiceSummaryResponse>>('/api/v1/invoices', {
        // The API compares instants; a bare date would be read as the UTC day (QA-008).
        params: params && {
          ...params,
          from: params.from ? localDayStartUtc(params.from) : undefined,
          to: params.to ? localDayEndUtc(params.to) : undefined,
        },
      })
      .then((r) => r.data),

  listByPatient: (
    patientId: string,
    params?: { status?: InvoiceStatus | ''; page?: number; pageSize?: number },
  ) =>
    apiClient
      .get<PagedResult<InvoiceSummaryResponse>>(`/api/v1/patients/${patientId}/invoices`, { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<InvoiceResponse>(`/api/v1/invoices/${id}`).then((r) => r.data),

  create: (patientId: string, body: CreateInvoiceRequest) =>
    apiClient
      .post<InvoiceResponse>(`/api/v1/patients/${patientId}/invoices`, body)
      .then((r) => r.data),

  update: (id: string, body: UpdateInvoiceRequest) =>
    apiClient.put<InvoiceResponse>(`/api/v1/invoices/${id}`, body).then((r) => r.data),

  voidInvoice: (id: string) =>
    apiClient.post<InvoiceResponse>(`/api/v1/invoices/${id}/void`).then((r) => r.data),

  addLineItem: (id: string, body: AddLineItemRequest) =>
    apiClient
      .post<InvoiceResponse>(`/api/v1/invoices/${id}/line-items`, body)
      .then((r) => r.data),

  updateLineItem: (id: string, itemId: string, body: UpdateLineItemRequest) =>
    apiClient
      .put<InvoiceResponse>(`/api/v1/invoices/${id}/line-items/${itemId}`, body)
      .then((r) => r.data),

  deleteLineItem: (id: string, itemId: string) =>
    apiClient.delete(`/api/v1/invoices/${id}/line-items/${itemId}`).then((r) => r.data),

  recordPayment: (id: string, body: RecordPaymentRequest) =>
    apiClient
      .post<InvoiceResponse>(`/api/v1/invoices/${id}/payments`, body)
      .then((r) => r.data),

  // The endpoint binds an (all-optional) JSON body; without one axios drops
  // Content-Type and the API answers 415 (QA-006).
  createFromTreatmentPlan: (treatmentPlanId: string) =>
    apiClient
      .post<InvoiceResponse>(`/api/v1/treatment-plans/${treatmentPlanId}/invoice`, {})
      .then((r) => r.data),
}
