import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { AppointmentsPage } from './AppointmentsPage'
import { appointmentService } from '../services/appointmentService'
import { staffService } from '@/features/staff/services/staffService'

vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { list: vi.fn(), listTypes: vi.fn() },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn() } }))

const appt = (id: string, startAt: string, status: string, patientName: string, providerId = 'd1', extra = {}) => ({
  id, patientId: `p-${id}`, patientName, providerId, appointmentTypeId: 'type-1', status, startAt,
  endAt: startAt, durationMinutes: 30, isNewPatient: false, chiefComplaint: null, notes: null, ...extra,
})

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

function renderList(query = 'from=2026-11-09&to=2026-11-15') {
  return renderWithProviders(
    <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
    { route: `/appointments?tab=list&${query}` },
  )
}

// User request 2026-11-12: the list follows the rest of the app — the calendar's toolbar,
// filters as buttons, visits grouped by day
describe('AppointmentsPage list', () => {
  beforeEach(() => {
    vi.mocked(appointmentService.list).mockReset().mockResolvedValue({
      items: [
        appt('a', '2026-11-10T08:00:00', 'Completed', 'Ana Anić', 'd1', { chiefComplaint: 'Tooth pain' }),
        appt('b', '2026-11-10T10:00:00', 'Scheduled', 'Bojan Bojić', 'd2'),
        appt('c', '2026-11-12T09:00:00', 'Scheduled', 'Cvijeta Cvijić', 'd1'),
      ],
      totalCount: 3, page: 1, pageSize: 200,
    } as never)
    vi.mocked(appointmentService.listTypes).mockResolvedValue([{ id: 'type-1', name: 'Filling' }] as never)
    vi.mocked(staffService.list).mockResolvedValue({
      items: [
        { id: 'd1', fullName: 'Dr One', isBookable: true, isActive: true, colorHex: '#3B82F6' },
        { id: 'd2', fullName: 'Dr Two', isBookable: true, isActive: true, colorHex: '#8B5CF6' },
        { id: 'r', fullName: 'Desk Person', isBookable: false, isActive: true },
      ],
      totalCount: 3, page: 1, pageSize: 100,
    } as never)
  })

  it('loads the whole period at once and filters on the page', async () => {
    renderList()

    await screen.findByText('Ana Anić')
    expect(appointmentService.list).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: '2026-11-09', dateTo: '2026-11-15', pageSize: 200, page: 1 }))
    expect(appointmentService.list).not.toHaveBeenCalledWith(expect.objectContaining({ status: expect.anything() }))
  })

  it('groups the visits by day, with the count of each day', async () => {
    renderList()

    const tuesday = await screen.findByRole('rowgroup', { name: /Tuesday, 10 November/ })
    expect(tuesday).toHaveTextContent('2 appointment(s)')
    expect(within(tuesday).getByText('Ana Anić')).toBeInTheDocument()
    expect(within(tuesday).getByText('Bojan Bojić')).toBeInTheDocument()
    expect(within(screen.getByRole('rowgroup', { name: /Thursday, 12 November/ })).getByText('Cvijeta Cvijić')).toBeInTheDocument()
  })

  it('shows the service and the reason for the visit', async () => {
    renderList()

    const row = (await screen.findByText('Ana Anić')).closest('tr')!
    expect(row).toHaveTextContent('Filling')
    expect(row).toHaveTextContent('Tooth pain')
    expect(row).toHaveTextContent('08:00')
  })

  it('has no drop-downs or checkbox, only buttons', async () => {
    renderList()

    await screen.findByText('Ana Anić')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('steps the period by its length with the arrows', async () => {
    renderList()

    expect(screen.getByRole('button', { name: /9 – 15 Nov 2026/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next period' }))

    expect(screen.getByRole('button', { name: /16 – 22 Nov 2026/ })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('from=2026-11-16')
    expect(screen.getByTestId('location')).toHaveTextContent('to=2026-11-22')

    await userEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('button', { name: /2 – 8 Nov 2026/ })).toBeInTheDocument()
  })

  it('picks a period from the period button', async () => {
    renderList()

    await userEvent.click(screen.getByRole('button', { name: /9 – 15 Nov 2026/ }))
    const panel = screen.getByRole('dialog', { name: 'Choose a period' })
    expect(within(panel).getByLabelText('From date')).toHaveAttribute('type', 'date')
    expect(within(panel).getByLabelText('To date')).toHaveAttribute('type', 'date')
    await userEvent.click(within(panel).getByRole('button', { name: 'This Month' }))

    expect(screen.queryByRole('dialog', { name: 'Choose a period' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/from=\d{4}-\d{2}-01/)
  })

  it('filters by doctor with the same buttons as the calendar', async () => {
    renderList()
    await screen.findByText('Bojan Bojić')

    const doctors = screen.getByRole('group', { name: 'Doctors' })
    expect(within(doctors).queryByRole('button', { name: 'Desk Person' })).not.toBeInTheDocument()
    await userEvent.click(within(doctors).getByRole('button', { name: 'Dr Two' }))

    expect(screen.getByTestId('location')).toHaveTextContent('doctors=d2')
    expect(screen.getByText('Bojan Bojić')).toBeInTheDocument()
    expect(screen.queryByText('Ana Anić')).not.toBeInTheDocument()
  })

  it('filters by status with buttons that count the visits', async () => {
    renderList()
    await screen.findByText('Ana Anić')

    const statuses = screen.getByRole('group', { name: 'Status' })
    expect(within(statuses).getByRole('button', { name: /^All statuses\s*3$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(statuses).getByRole('button', { name: /^Scheduled\s*2$/ })).toBeInTheDocument()
    await userEvent.click(within(statuses).getByRole('button', { name: /^Completed\s*1$/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('status=Completed')
    expect(screen.getByText('Ana Anić')).toBeInTheDocument()
    expect(screen.queryByText('Bojan Bojić')).not.toBeInTheDocument()
  })

  it('finds a visit by the patient name', async () => {
    renderList()
    await screen.findByText('Ana Anić')

    await userEvent.type(screen.getByRole('textbox', { name: 'Search appointments' }), 'cvij')

    expect(screen.getByText('Cvijeta Cvijić')).toBeInTheDocument()
    expect(screen.queryByText('Ana Anić')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })
})
