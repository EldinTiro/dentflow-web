import apiClient from '@/shared/api/client'

/** A payment with what it paid for. `paidAt` is a UTC instant. */
export interface FinancePayment {
  invoiceId: string
  invoiceNumber: string
  patientId: string
  patientName: string
  amount: number
  method: string
  paidAt: string
  reference: string | null
}

/** Invoiced in the period; outstanding/overdue are "right now". */
export interface FinanceSummary {
  invoiced: number
  outstanding: number
  outstandingPatients: number
  overdue: number
  overduePatients: number
}

export interface FinanceDebtor {
  patientId: string
  patientName: string
  patientNumber: string
  phoneMobile: string | null
  balance: number
  overdueBalance: number
  openInvoices: number
  oldestOpenIssuedAt: string
}

/** UTC instants for a span of the clinic's local days — build with monthRange / localDay*Utc. */
export interface FinancePeriod {
  from: string
  to: string
}

/** Clinic-level money: every call requires finance.view (owner, manager, accountants). */
export const financeService = {
  getPayments: (period: FinancePeriod): Promise<FinancePayment[]> =>
    apiClient.get('/api/v1/finance/payments', { params: period }).then((r) => r.data),
  getSummary: (period: FinancePeriod): Promise<FinanceSummary> =>
    apiClient.get('/api/v1/finance/summary', { params: period }).then((r) => r.data),
  getDebtors: (): Promise<FinanceDebtor[]> =>
    apiClient.get('/api/v1/finance/debtors').then((r) => r.data),
}
