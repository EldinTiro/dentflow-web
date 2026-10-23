import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { localDayStartUtc, localDayEndUtc } from '@/shared/lib/dates'
import { financeService, type FinancePayment } from '../services/financeService'
import { CashUpPage } from './CashUpPage'
import { DebtorsPage } from './DebtorsPage'
import { FinanceOverviewPage } from './FinanceOverviewPage'

vi.mock('../services/financeService', () => ({
  financeService: { getPayments: vi.fn(), getSummary: vi.fn(), getDebtors: vi.fn() },
}))

const pay = (patientName: string, amount: number, method: string, paidAt: string): FinancePayment => ({
  invoiceId: `inv-${patientName}`, invoiceNumber: `INV-${patientName}`, patientId: `pat-${patientName}`,
  patientName, amount, method, paidAt, reference: null,
})

function at(path: string, element: React.ReactElement, route: string) {
  return renderWithProviders(<Routes><Route path={path} element={element} /></Routes>, { route })
}

describe('CashUpPage', () => {
  beforeEach(() => {
    vi.mocked(financeService.getPayments).mockReset()
    vi.mocked(financeService.getPayments).mockResolvedValue([
      pay('Lejla Hasanović', 80, 'Cash', '2026-10-22T08:15:00Z'),
      pay('Amar Begić', 20, 'Cash', '2026-10-22T10:00:00Z'),
      pay('Selma Delić', 30, 'Card', '2026-10-22T12:30:00Z'),
    ])
  })

  // Closing the till: every payment of the clinic's local day, totalled per method
  it("asks for the clinic's local day and totals it per payment method", async () => {
    at('/finance/cash-up', <CashUpPage />, '/finance/cash-up?date=2026-10-22')

    expect(await screen.findByText('Lejla Hasanović')).toBeInTheDocument()
    expect(financeService.getPayments).toHaveBeenCalledWith({
      from: localDayStartUtc('2026-10-22'), to: localDayEndUtc('2026-10-22'),
    })
    expect(within(screen.getByTestId('method-Cash')).getByText('100.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('method-Card')).getByText('30.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('day-total')).getByText('130.00 KM')).toBeInTheDocument()
  })
})

describe('DebtorsPage', () => {
  it('lists who owes money, with totals per age group', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
    vi.mocked(financeService.getDebtors).mockResolvedValue([
      { patientId: 'a', patientName: 'Old Debt', patientNumber: 'P-1', phoneMobile: '+38761111222', balance: 300, overdueBalance: 300, openInvoices: 2, oldestOpenIssuedAt: '2026-07-01T10:00:00Z' },
      { patientId: 'b', patientName: 'New Debt', patientNumber: 'P-2', phoneMobile: null, balance: 45, overdueBalance: 0, openInvoices: 1, oldestOpenIssuedAt: '2026-10-15T10:00:00Z' },
    ])

    at('/finance/debtors', <DebtorsPage />, '/finance/debtors')

    expect(await screen.findByRole('link', { name: 'Old Debt' })).toHaveAttribute('href', '/patients/a?tab=billing')
    expect(within(screen.getByTestId('bucket-0-30')).getByText('45.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('bucket-60+')).getByText('300.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('debtors-total')).getByText('345.00 KM')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('FinanceOverviewPage', () => {
  it("shows the month's collected and invoiced amounts and what is owed now", async () => {
    vi.mocked(financeService.getPayments).mockResolvedValue([
      pay('A', 100, 'Cash', '2026-10-05T09:00:00Z'),
      pay('B', 30, 'Card', '2026-10-20T09:00:00Z'),
      pay('C', 65, 'Cash', '2026-09-10T09:00:00Z'),
    ])
    vi.mocked(financeService.getSummary).mockImplementation(async ({ from }) =>
      from === localDayStartUtc('2026-10-01')
        ? { invoiced: 400, outstanding: 210, outstandingPatients: 3, overdue: 90, overduePatients: 1 }
        : { invoiced: 200, outstanding: 210, outstandingPatients: 3, overdue: 90, overduePatients: 1 })

    at('/finance', <FinanceOverviewPage />, '/finance?month=2026-10')

    expect(await within(await screen.findByTestId('kpi-collected')).findByText('130.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-collected')).getByText(/100%/)).toBeInTheDocument() // 130 vs 65
    expect(await within(screen.getByTestId('kpi-invoiced')).findByText('400.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-outstanding')).getByText('210.00 KM')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-overdue')).getByText('90.00 KM')).toBeInTheDocument()
  })
})
