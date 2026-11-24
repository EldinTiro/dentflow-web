import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { patientService } from '../services/patientService'
import { CreatePatientDrawer } from './CreatePatientDrawer'
import { OpenCardDialog } from './OpenCardDialog'

vi.mock('../services/patientService', async (orig) => {
  const actual = await orig<typeof import('../services/patientService')>()
  return { ...actual, patientService: { ...actual.patientService, create: vi.fn(), openCard: vi.fn() } }
})

const svc = vi.mocked(patientService)

// Client request 2026-11-10: a patient who books by email has no paper card yet; the card
// (and its number) is opened when they first come, so a no-show uses up no number.
describe('a patient without a card', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('can be saved without a card number', async () => {
    svc.create.mockResolvedValue({} as never)
    const user = userEvent.setup()
    renderWithProviders(<CreatePatientDrawer onClose={() => {}} />)

    await user.click(screen.getByRole('checkbox', { name: /no card yet/i }))
    expect(screen.queryByLabelText(/patient number/i)).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Jane'), 'Anita')
    await user.type(screen.getByPlaceholderText('Doe'), 'Zaimović')
    await user.click(screen.getByRole('button', { name: /create patient/i }))

    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({ withoutCard: true, patientNumber: null, firstName: 'Anita' })))
  })

  it('opens the card with the next free number when none is typed', async () => {
    svc.openCard.mockResolvedValue({ patientNumber: '4252' } as never)
    const onDone = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<OpenCardDialog patientId="p1" patientName="Anita Zaimović" onClose={onDone} />)

    await user.click(screen.getByRole('button', { name: /^open card$/i }))

    await waitFor(() => expect(svc.openCard).toHaveBeenCalledWith('p1', null))
    expect(onDone).toHaveBeenCalled()
  })

  it("opens the card with the paper card's number", async () => {
    svc.openCard.mockResolvedValue({ patientNumber: '4377' } as never)
    const user = userEvent.setup()
    renderWithProviders(<OpenCardDialog patientId="p1" patientName="Anita Zaimović" onClose={() => {}} />)

    await user.type(screen.getByLabelText(/card number/i), '4377')
    await user.click(screen.getByRole('button', { name: /^open card$/i }))

    await waitFor(() => expect(svc.openCard).toHaveBeenCalledWith('p1', '4377'))
  })

  it('says so when the number belongs to another patient', async () => {
    svc.openCard.mockRejectedValue(fastEndpointsError('Taken', 'patient.PatientNumberAlreadyExists', 409))
    const onDone = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<OpenCardDialog patientId="p1" patientName="Anita Zaimović" onClose={onDone} />)

    await user.type(screen.getByLabelText(/card number/i), '4100')
    await user.click(screen.getByRole('button', { name: /^open card$/i }))

    expect(await screen.findByText(/another patient already has card number/i)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
