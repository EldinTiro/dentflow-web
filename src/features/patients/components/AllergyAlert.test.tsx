import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AllergyAlert } from './AllergyAlert'
import { patientService, type Allergy } from '../services/patientService'

vi.mock('../services/patientService', async (orig) => {
  const actual = await orig<typeof import('../services/patientService')>()
  return { ...actual, patientService: { ...actual.patientService, listAllergies: vi.fn(), getMedicalHistory: vi.fn(async () => null) } }
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

  // DT-10: "Latex allergy" ticked in the medical history gave no warning in the header
  it('warns about latex and treatment-relevant conditions from the medical history', async () => {
    vi.mocked(patientService.listAllergies).mockResolvedValue([])
    vi.mocked(patientService.getMedicalHistory).mockResolvedValue({
      hasLatexAllergy: true, isOnBloodThinners: true, hasPacemaker: true,
      isSmoker: true, isDiabetic: false, hasHeartCondition: false, hasHypertension: false,
      hasBleedingDisorder: false, hasArtificialJoints: false, isPregnant: null,
    } as never)
    renderWithProviders(<AllergyAlert patientId="p1" />)

    const alerts = await screen.findAllByRole('alert')
    const text = alerts.map((a) => a.textContent).join(' ')
    expect(text).toMatch(/Latex/)
    expect(text).toMatch(/Blood thinners/)
    expect(text).toMatch(/Pacemaker/)
    expect(text).not.toMatch(/Smoker/)
  })
})
