import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { PatientDetailPage } from './PatientDetailPage'
import { patientService } from '../services/patientService'

const { pending } = vi.hoisted(() => ({ pending: () => new Promise<never>(() => {}) }))
vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: {
    getById: vi.fn(async () => ({
      id: 'p1', patientNumber: 'P-000001', firstName: 'Lejla', lastName: 'Hasanović', fullName: 'Lejla Hasanović',
      status: 'Active', gender: 'Female', dateOfBirth: '1992-03-12', phoneMobile: '+38761123456', preferredName: null,
      parentName: 'Hasan', createdAt: '2026-10-01T00:00:00Z', updatedAt: null, hasHistory: true,
      insights: {
        lastVisitAt: new Date(2026, 9, 22, 9, 0).toISOString(),
        nextAppointment: { id: 'ap', startAt: new Date(2026, 10, 4, 10, 30).toISOString(), providerId: 'd1' },
        balanceDue: 60, allergyCount: 1, severestAllergy: 'Severe',
      },
    })),
    listAllergies: vi.fn(async () => []),
    openCard: vi.fn(async () => ({ patientNumber: '4252' })),
    timeline: vi.fn(async () => [
      { at: new Date(2026, 10, 4, 10, 30).toISOString(), kind: 'appointment', refId: 'ap', status: 'Scheduled', label: 'Kontrola', detail: 'Lejla Drino', amount: null },
      { at: new Date(2026, 9, 22, 11, 0).toISOString(), kind: 'payment', refId: 'pay', status: 'Cash', label: 'INV-0005', detail: null, amount: 20 },
      { at: new Date(2026, 9, 22, 10, 0).toISOString(), kind: 'finding', refId: 'f1', status: null, label: '36 Filling MOD', detail: null, amount: null },
    ]),
  },
}))
vi.mock('@/features/appointments/services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/services/appointmentService')>()),
  appointmentService: { list: vi.fn(pending), listTypes: vi.fn(async () => []), getAvailableSlots: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({
  staffService: { list: vi.fn(async () => ({ items: [{ id: 'd1', fullName: 'Lejla Drino' }], totalCount: 1, page: 1, pageSize: 100 })) },
}))
vi.mock('@/features/admin/services/tenantService', () => ({ tenantService: { getSettings: vi.fn(pending) } }))
vi.mock('../services/toothChartService', () => ({ toothChartService: { list: vi.fn(async () => []) } }))
vi.mock('@/features/treatments/services/treatmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/treatments/services/treatmentService')>()),
  treatmentService: { list: vi.fn(async () => ({ items: [{ id: 'tp', items: [{ status: 'Completed' }, { status: 'Planned' }] }], totalCount: 1, page: 1, pageSize: 50 })) },
}))
vi.mock('@/features/auth/services/userService', () => ({ userService: { getPreferences: vi.fn(async () => ({ timeFormat: '24h' })) } }))

const renderPage = () => renderWithProviders(
  <Routes><Route path="/patients/:id" element={<PatientDetailPage />} /></Routes>,
  { route: '/patients/p1' },
)

// Patients redesign C: the record leads with what matters, not with empty demographics
describe('PatientDetailPage redesign', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0))
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: ['Staff'] })
  })
  afterEach(async () => { vi.useRealTimers(); useAuthStore.getState().clearAuth(); await i18n.changeLanguage('en') })

  // Client request 2026-11-10: the card of a patient booked by email is opened on their first visit
  it('offers to open the card of a patient who has none yet', async () => {
    const base = await vi.mocked(patientService.getById).getMockImplementation()!('p1')
    vi.mocked(patientService.getById).mockResolvedValueOnce({ ...base, patientNumber: null } as never)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    expect(await screen.findByText('No card')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^open card…?$/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^open card$/i }))

    await vi.waitFor(() => expect(patientService.openCard).toHaveBeenCalledWith('p1', null))
  })

  // The header said "Spol: Female" in Bosnian
  it('says who the patient is in the header, in the app language', async () => {
    await i18n.changeLanguage('bs')
    renderPage()

    const header = await screen.findByRole('region', { name: 'Lejla Hasanović' })
    expect(header).toHaveTextContent('P-000001')
    expect(header).toHaveTextContent('Ženski · 34 god')
    expect(header).toHaveTextContent('+38761123456')
    expect(document.body).not.toHaveTextContent('Female')
  })

  it('leads the overview with the next visit, last visit, balance and treatment progress', async () => {
    renderPage()

    const facts = await screen.findByRole('list', { name: 'Key facts' })
    expect(facts).toHaveTextContent('Today 10:30')
    expect(await within(facts).findByText(/Lejla Drino/)).toBeInTheDocument()
    expect(facts).toHaveTextContent('22 Oct')
    expect(facts).toHaveTextContent('60.00 KM')
    expect(await within(facts).findByText('1 / 2')).toBeInTheDocument()
    // Labels are real text, not missing-key fallbacks
    for (const label of ['Next appointment', 'Last visit', 'Owed', 'Treatment plan']) {
      expect(within(facts).getByText(label)).toBeInTheDocument()
    }
  })

  it('shows what happened as a timeline, newest first', async () => {
    renderPage()

    const timeline = await screen.findByRole('list', { name: 'Timeline' })
    const items = await within(timeline).findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Kontrola')
    expect(items[0]).toHaveTextContent('Lejla Drino')
    expect(items[1]).toHaveTextContent('20.00 KM')
    expect(items[2]).toHaveTextContent('Tooth 36 · Filling MOD')
  })
})
