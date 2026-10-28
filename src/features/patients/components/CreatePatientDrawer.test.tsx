import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { CreatePatientDrawer } from './CreatePatientDrawer'
import { patientService } from '../services/patientService'

vi.mock('../services/patientService', async (orig) => {
  const actual = await orig<typeof import('../services/patientService')>()
  return { ...actual, patientService: { ...actual.patientService, create: vi.fn() } }
})

const create = vi.mocked(patientService.create)

async function fillNamesAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('Jane'), 'QA')
  await user.type(screen.getByPlaceholderText('Doe'), 'Patient')
  await user.click(screen.getByRole('button', { name: /create patient/i }))
}

describe('CreatePatientDrawer', () => {
  beforeEach(() => {
    create.mockReset()
  })

  // QA-001: a FastEndpoints validation error used to unmount the whole app
  it('shows the server validation reason inline instead of crashing', async () => {
    create.mockRejectedValue(fastEndpointsError('Date of birth cannot be in the future', 'dateOfBirth'))
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)

    await fillNamesAndSubmit()

    expect(await screen.findByText('Date of birth cannot be in the future')).toBeInTheDocument()
  })

  // QA-007: DOB was pre-filled with 2000-01-01 and silently saved
  it('sends no date of birth when the field is left empty', async () => {
    create.mockResolvedValue({} as never)
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)

    await fillNamesAndSubmit()

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].dateOfBirth).toBeNull()
  })

  // QA-019: "+387" + "12" was accepted as a mobile number
  it('rejects a phone number that is too short', async () => {
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/61 123 456|phone/i), '12')

    await fillNamesAndSubmit()

    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  // QA-028: inputs were named by their placeholder ("Jane", "Doe") — no <label for>
  it('labels every field', () => {
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)

    for (const name of ['First Name *', 'Last Name *', 'Email', 'Date of Birth', 'Mobile Phone', 'SMS opt-in']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  // DT-36 / QA-047: "+387" + "61 234 567" was stored as "+38761 234 567"
  it('keeps a space between the dial code and the number', async () => {
    create.mockResolvedValue({} as never)
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('61 123 456'), '061 234 567')

    await fillNamesAndSubmit()

    expect(create.mock.calls[0][0].phoneMobile).toBe('+387 61 234 567')
  })
})
