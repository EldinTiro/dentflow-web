import apiClient from '@/shared/api/client'

export type InvoiceStatus = 'Draft' | 'Sent' | 'PartiallyPaid' | 'Paid' | 'Void'
export type PaymentMethod = 'Cash' | 'Card' | 'Insurance' | 'BankTransfer' | 'Other'

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
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }) =>
    apiClient
      .get<PagedResult<InvoiceSummaryResponse>>('/api/v1/invoices', { params })
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
}
