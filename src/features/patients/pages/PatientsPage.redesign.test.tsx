import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService } from '../services/patientService'
import { PatientsPage } from './PatientsPage'

vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: {
    list: vi.fn(),
    listAllergies: vi.fn(async () => [{ id: 'a1', allergen: 'Penicillin', severity: 'Severe', reaction: null, notes: null, reportedAt: null }]),
  },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: { list: vi.fn(async () => ({ items: [{ id: 'd1', fullName: 'Lejla Drino' }], totalCount: 1, page: 1, pageSize: 100 })) },
}))
vi.mock('@/features/treatments/services/treatmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/treatments/services/treatmentService')>()),
  treatmentService: { list: vi.fn(async () => ({ items: [{ id: 'tp', items: [{ status: 'Completed' }, { status: 'Planned' }] }], totalCount: 1, page: 1, pageSize: 50 })) },
}))

const insights = (over: object = {}) => ({ lastVisitAt: null, nextAppointment: null, balanceDue: 0, allergyCount: 0, severestAllergy: null, visitCount: 0, documentCount: 0, firstVisitAt: null, ...over })
const patient = (id: string, fullName: string, over: object = {}) => ({
  id, patientNumber: `P-${id}`, fullName, status: 'Active', parentName: null, dateOfBirth: '1992-03-12',
  phoneMobile: '+38761123456', email: null, insights: insights(), ...over,
})
const page = (items: unknown[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1, hasPreviousPage: false, hasNextPage: false })

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}
const renderPage = () => renderWithProviders(
  <Routes><Route path="/patients" element={<><PatientsPage /><Where /></>} /><Route path="/patients/:id" element={<Where />} /></Routes>,
  { route: '/patients' },
)

describe('PatientsPage redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0))
    vi.mocked(patientService.list).mockResolvedValue(page([
      patient('1', 'Lejla Hasanović', { insights: insights({ allergyCount: 1, severestAllergy: 'Severe', nextAppointment: { id: 'ap', startAt: new Date(2026, 10, 4, 10, 30).toISOString(), providerId: 'd1' } }) }),
      patient('2', 'Karlo Mijatović', { insights: insights({ balanceDue: 60, lastVisitAt: new Date(2026, 9, 30, 9, 0).toISOString(), firstVisitAt: new Date(2021, 1, 15, 9, 0).toISOString(), visitCount: 7, documentCount: 3 }) }),
    ]) as never)
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: ['Staff'] })
  })
  afterEach(() => { vi.useRealTimers(); useAuthStore.getState().clearAuth() })

  // Client request 2026-11-10: booked by email, card not opened yet
  it('marks a patient whose card is not opened yet', async () => {
    vi.mocked(patientService.list).mockResolvedValue(page([patient('9', 'Anita Zaimović', { patientNumber: null })]) as never)
    renderPage()

    const anita = (await screen.findByText('Anita Zaimović')).closest('tr')!
    expect(within(anita).getByText('No card')).toBeInTheDocument()
  })

  // A: what the desk needs per row, instead of empty columns
  // User request: date of birth instead of the next appointment, and the last visit with its year
  it('shows age, phone, date of birth, last visit and an allergy warning per patient', async () => {
    renderPage()

    const lejla = (await screen.findByText('Lejla Hasanović')).closest('tr')!
    expect(within(lejla).getByLabelText('Allergy: Severe')).toBeInTheDocument()
    expect(lejla).toHaveTextContent('34 y')
    expect(lejla).toHaveTextContent('+38761123456')
    expect(lejla).toHaveTextContent('12/03/1992')
    expect(lejla).not.toHaveTextContent('Today 10:30')
    expect(screen.getByRole('columnheader', { name: 'Date of birth' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Next appointment' })).not.toBeInTheDocument()
    expect(screen.getByText('Karlo Mijatović').closest('tr')!).toHaveTextContent('30 Oct 2026')
  })

  // User request: no quick filters, and the balance stays out of the list (it is in the preview)
  it('has no quick filters and no balance column', async () => {
    renderPage()

    const karlo = (await screen.findByText('Karlo Mijatović')).closest('tr')!
    expect(screen.queryByRole('button', { name: /^Owing/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Balance' })).not.toBeInTheDocument()
    expect(karlo).not.toHaveTextContent('60.00 KM')
  })

  // User request 2026-11-13: no preview; a click opens the patient's tooth chart
  it('opens the tooth chart of the patient clicked, with no preview', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await user.click(await screen.findByText('Karlo Mijatović'))

    expect(screen.getByTestId('where')).toHaveTextContent('/patients/2?tab=teeth')
    expect(screen.queryByRole('region', { name: 'Karlo Mijatović' })).not.toBeInTheDocument()
  })
})
