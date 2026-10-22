import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AllergyAlert } from './AllergyAlert'
import { patientService, type Allergy } from '../services/patientService'

vi.mock('../services/patientService', async (orig) => {
  const actual = await orig<typeof import('../services/patientService')>()
  return { ...actual, patientService: { ...actual.patientService, listAllergies: vi.fn() } }
})

const allergy = (allergen: string, severity: string | null): Allergy =>
  ({ id: allergen, allergen, severity, reaction: null, notes: null, reportedAt: null })

describe('AllergyAlert', () => {
  beforeEach(() => {
    vi.mocked(patientService.listAllergies).mockReset()
  })

  // QA-010: a life-threatening allergy was only visible inside the Medical tab
  it('shows every allergy with its severity, the dangerous ones first', async () => {
    vi.mocked(patientService.listAllergies).mockResolvedValue([
      allergy('Latex', 'Mild'),
      allergy('Penicillin', 'LifeThreatening'),
    ])
    renderWithProviders(<AllergyAlert patientId="p1" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Penicillin \(Life-threatening\).*Latex \(Mild\)/)
  })

  it('renders nothing when the patient has no allergies', async () => {
    vi.mocked(patientService.listAllergies).mockResolvedValue([])
    const { container } = renderWithProviders(<AllergyAlert patientId="p1" />)

    await vi.waitFor(() => expect(patientService.listAllergies).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
