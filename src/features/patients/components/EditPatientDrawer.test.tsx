import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { EditPatientDrawer } from './EditPatientDrawer'
import { patientService, type PatientResponse } from '../services/patientService'

vi.mock('../services/patientService', async (orig) => {
  const actual = await orig<typeof import('../services/patientService')>()
  return { ...actual, patientService: { ...actual.patientService, update: vi.fn() } }
})

const update = vi.mocked(patientService.update)

function patient(over: Partial<PatientResponse> = {}): PatientResponse {
  return {
    id: 'p1', patientNumber: 'P-0001', firstName: 'Lejla', lastName: 'Hodžić', preferredName: null, parentName: null,
    fullName: 'Lejla Hodžić', displayName: 'Lejla Hodžić', dateOfBirth: null, gender: null, email: null,
    phoneMobile: '+387 61123456', phoneHome: null, phoneWork: null, preferredContactMethod: null,
    addressLine1: null, addressLine2: null, city: null, stateProvince: null, postalCode: null, countryCode: null,
    status: 'Active', firstVisitDate: null, lastVisitDate: null, recallDueDate: null, preferredProviderId: 'doc-1',
    smsOptIn: false, emailOptIn: false, notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
    ...over,
  }
}

const save = () => userEvent.setup().click(screen.getByRole('button', { name: /save changes/i }))

describe('EditPatientDrawer', () => {
  beforeEach(() => {
    update.mockReset()
    update.mockResolvedValue({} as never)
  })

  // Same mobile field as when adding a patient: dial code picker + the local number
  it('splits the stored mobile into dial code and local number', () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: /\+387/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Mobile Phone')).toHaveValue('61123456')
  })

  it('reads a number stored without a space after the dial code', () => {
    renderWithProviders(<EditPatientDrawer patient={patient({ phoneMobile: '+38562111222' })} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: /\+385/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Mobile Phone')).toHaveValue('62111222')
  })

  it('saves the mobile in the same format as when adding a patient', async () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)
    const user = userEvent.setup()
    const mobile = screen.getByLabelText('Mobile Phone')
    await user.clear(mobile)
    await user.type(mobile, '062 333 444')

    await save()

    expect(update.mock.calls[0][1].phoneMobile).toBe('+387 62 333 444')
  })

  it('rejects a phone number that is too short', async () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)
    const user = userEvent.setup()
    const mobile = screen.getByLabelText('Mobile Phone')
    await user.clear(mobile)
    await user.type(mobile, '12')

    await save()

    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('labels the fields like the add-patient form', () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)

    for (const name of ['First Name *', 'Last Name *', 'Email', 'Date of Birth', 'Mobile Phone', 'SMS opt-in', 'Notes']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  // Saving used to send preferredProviderId: undefined, which cleared the patient's doctor
  it('keeps the preferred doctor', async () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)

    await save()

    expect(update.mock.calls[0][1].preferredProviderId).toBe('doc-1')
  })

  // User request 2026-11-13: the same named groups as the other forms
  it('groups the fields into named sections', () => {
    renderWithProviders(<EditPatientDrawer patient={patient()} onClose={() => {}} />)

    for (const name of ['Basic details', 'Contact', 'Address', 'Notes']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument()
    }
  })
})
