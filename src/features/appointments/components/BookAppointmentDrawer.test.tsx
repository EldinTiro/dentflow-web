import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { BookAppointmentDrawer } from './BookAppointmentDrawer'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 100 }) }))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))
vi.mock('@/features/admin/services/tenantService', () => ({ tenantService: { getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })) } }))
vi.mock('@/features/auth/services/userService', () => ({ userService: { getPreferences: vi.fn(async () => ({ timeFormat: '24h' })) } }))
vi.mock('@/features/patients/services/patientService', async (orig) => ({
  ...(await orig<typeof import('@/features/patients/services/patientService')>()),
  patientService: { search: vi.fn(async () => []), listAllergies: vi.fn(async () => []) },
}))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { listTypes: vi.fn(async () => []), getAvailableSlots: vi.fn(async () => []), book: vi.fn() },
}))

describe('BookAppointmentDrawer', () => {
  afterEach(() => i18n.changeLanguage('en'))

  // QA-020: labels were hard-coded Bosnian, and "Pacijent je obavezan" sat next to "Provider is required"
  it.each([
    ['en', 'Book Appointment', 'Patient is required', 'Provider is required'],
    ['bs', 'Zakaži termin', 'Pacijent je obavezan', 'Doktor je obavezan'],
  ])('speaks one language (%s)', async (lang, title, patientMsg, providerMsg) => {
    await i18n.changeLanguage(lang)
    renderWithProviders(<BookAppointmentDrawer onClose={() => {}} />)

    expect(screen.getByText(title)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: i18n.t('appointments:booking.book') }))

    expect(await screen.findByText(patientMsg)).toBeInTheDocument()
    expect(screen.getByText(providerMsg)).toBeInTheDocument()
  })

  // DR-36: the visible labels were not wired to their controls, so screen readers
  // announced placeholders or bare "combobox" for the most-used form in the app.
  it('names every control by its visible label', () => {
    renderWithProviders(<BookAppointmentDrawer onClose={() => {}} />)

    expect(screen.getByLabelText(/^Patient/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Provider/)).toHaveRole('combobox')
    expect(screen.getByLabelText(/^Appointment type/)).toHaveRole('combobox')
    expect(screen.getByLabelText(/^Date and time/)).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Hour')).toHaveRole('combobox')
    expect(screen.getByLabelText('Minute')).toHaveRole('combobox')
    expect(screen.getByLabelText('Duration (min)')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Reason for visit')).toHaveRole('textbox')
    expect(screen.getByLabelText('Notes')).toHaveRole('textbox')
  })
})
