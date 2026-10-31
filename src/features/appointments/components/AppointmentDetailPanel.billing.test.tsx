import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { appointmentFixture } from '@/test/fixtures/appointment'
import { billingService } from '@/features/billing/services/billingService'
import { AppointmentDetailPanel } from './AppointmentDetailPanel'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('@/features/patients/services/patientService', () => ({
  patientService: { getById: vi.fn(pending), listAllergies: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { getById: vi.fn(pending) } }))
vi.mock('@/features/billing/services/billingService', async (orig) => ({
  ...(await orig<typeof import('@/features/billing/services/billingService')>()),
  billingService: { listByPatient: vi.fn() },
}))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { listTypes: vi.fn(pending), getHistory: vi.fn(async () => []), updateStatus: vi.fn() },
}))

const invoice = (status: string) => ({
  id: 'inv-1', patientId: 'pat-1', invoiceNumber: 'INV-20261031-0001', status, issuedAt: '2026-10-31T01:00:00Z',
  dueDate: null, subTotal: 50, paidAmount: status === 'Paid' ? 50 : 0, balanceDue: status === 'Paid' ? 0 : 50,
  lineItemCount: 1, createdAt: '2026-10-31T01:00:00Z', patientName: 'Eldin Tiro', isOverdue: false, appointmentId: 'appt-1',
})
const page = (items: unknown[]) => ({ items, totalCount: items.length, page: 1, pageSize: 5 })

function renderPanel() {
  return renderWithProviders(
    <AppointmentDetailPanel appointment={appointmentFixture({ id: 'appt-1', status: 'Completed' })} onClose={() => {}} onReschedule={() => {}} canManage />,
  )
}

// User report: "Bill patient" stayed enabled after the visit had been billed
describe('AppointmentDetailPanel billing', () => {
  beforeEach(() => { vi.mocked(billingService.listByPatient).mockReset() })

  it('shows the invoice instead of offering to bill a visit twice', async () => {
    vi.mocked(billingService.listByPatient).mockResolvedValue(page([invoice('Paid')]) as never)
    renderPanel()

    const link = await screen.findByRole('link', { name: /INV-20261031-0001/ })
    expect(link).toHaveAttribute('href', '/invoices/inv-1')
    expect(link).toHaveTextContent('Paid')
    expect(screen.queryByRole('button', { name: 'Bill patient' })).not.toBeInTheDocument()
  })

  it('asks for the invoices of this visit only', async () => {
    vi.mocked(billingService.listByPatient).mockResolvedValue(page([]) as never)
    renderPanel()

    await screen.findByRole('button', { name: 'Bill patient' })
    expect(billingService.listByPatient).toHaveBeenCalledWith('pat-1', expect.objectContaining({ appointmentId: 'appt-1' }))
  })

  // A voided invoice bills nothing: the visit can be billed again (the API allows it too)
  it('offers to bill again when the only invoice was voided', async () => {
    vi.mocked(billingService.listByPatient).mockResolvedValue(page([invoice('Void')]) as never)
    renderPanel()

    expect(await screen.findByRole('button', { name: 'Bill patient' })).toBeInTheDocument()
  })

  it('does not offer to bill before it knows whether the visit was billed', () => {
    vi.mocked(billingService.listByPatient).mockReturnValue(new Promise(() => {}) as never)
    renderPanel()

    expect(screen.queryByRole('button', { name: 'Bill patient' })).not.toBeInTheDocument()
  })
})
