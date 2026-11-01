import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { BookAppointmentDrawer } from './BookAppointmentDrawer'
import { staffService } from '@/features/staff/services/staffService'
import { appointmentService } from '../services/appointmentService'

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

describe('BookAppointmentDrawer after booking', () => {
  // Bug: a booking made from the calendar did not appear until a manual reload —
  // only ['appointments'] was refreshed, and the week view caches under ['appointments-week']
  it('refreshes the calendar week so the new visit shows up', async () => {
    vi.mocked(staffService.list).mockResolvedValue({
      items: [{ id: 'prov-1', fullName: 'Ana Rozić', staffType: 'Dentist', isBookable: true }], totalCount: 1, page: 1, pageSize: 100,
    } as unknown as Awaited<ReturnType<typeof staffService.list>>)
    vi.mocked(appointmentService.listTypes).mockResolvedValue([
      { id: 'type-1', name: 'Filling', defaultDurationMinutes: 45 },
    ] as unknown as Awaited<ReturnType<typeof appointmentService.listTypes>>)
    vi.mocked(appointmentService.book).mockResolvedValue({} as Awaited<ReturnType<typeof appointmentService.book>>)

    const { queryClient } = renderWithProviders(
      <BookAppointmentDrawer
        onClose={() => {}}
        initialPatient={{ id: 'pat-1', patientNumber: 'P-1', fullName: 'Lejla Hasanović', phoneMobile: null, email: null }}
        initialStartAt="2026-10-23T11:00"
        initialProviderId="prov-1"
      />,
    )
    queryClient.setQueryData(['appointments-week', '2026-10-19'], { items: [] })

    await screen.findByRole('option', { name: /Ana Rozić/ })
    await screen.findByRole('option', { name: /Filling/ })
    await userEvent.selectOptions(screen.getByLabelText(/^Provider/), 'prov-1')
    await userEvent.selectOptions(screen.getByLabelText(/^Appointment type/), 'type-1')
    await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }))

    await vi.waitFor(() => expect(appointmentService.book).toHaveBeenCalled())
    await vi.waitFor(() => expect(queryClient.getQueryState(['appointments-week', '2026-10-19'])?.isInvalidated).toBe(true))
  })
})

describe('BookAppointmentDrawer providers', () => {
  // People-merge plan 1.2 / D3: the API decides who can be booked (isBookable)
  it('offers exactly the bookable staff', async () => {
    const person = (id: string, fullName: string, staffType: string, isBookable: boolean) =>
      ({ id, fullName, firstName: fullName, lastName: '', staffType, isBookable, isActive: true })
    vi.mocked(staffService.list).mockResolvedValueOnce({
      items: [
        person('d1', 'Amra Dentist', 'Dentist', true),
        person('a1', 'Nina Assistant', 'DentalAssistant', true),
        person('h1', 'Old Hygienist', 'Hygienist', false),
        person('r1', 'Rea Reception', 'Receptionist', false),
      ],
      totalCount: 4, page: 1, pageSize: 100,
    } as never)
    renderWithProviders(<BookAppointmentDrawer onClose={() => {}} />)

    const provider = screen.getByLabelText(/^Provider/) as HTMLSelectElement
    await screen.findByRole('option', { name: /Amra Dentist/ })
    const names = [...provider.options].filter((o) => o.value).map((o) => o.textContent)
    expect(names).toEqual(['Amra Dentist — Dentist', 'Nina Assistant — Dental technician'])
  })

  // Bug: clicking Ana's column in the day view opened the form with no doctor chosen —
  // the doctors load after the form, so the select had no matching option yet
  it('chooses the given doctor once the doctors have loaded', async () => {
    vi.mocked(staffService.list).mockResolvedValueOnce({
      items: [
        { id: 'p1', fullName: 'Eldina Muhić', firstName: 'Eldina', lastName: 'Muhić', staffType: 'Dentist', isBookable: true, isActive: true },
        { id: 'p2', fullName: 'Ana Rozić', firstName: 'Ana', lastName: 'Rozić', staffType: 'Dentist', isBookable: true, isActive: true },
      ],
      totalCount: 2, page: 1, pageSize: 100,
    } as never)
    renderWithProviders(<BookAppointmentDrawer onClose={() => {}} initialProviderId="p2" initialStartAt="2026-10-30T10:00" />)

    await screen.findByRole('option', { name: /Ana Rozić/ })
    expect(screen.getByLabelText(/^Provider/)).toHaveValue('p2')
  })
})
