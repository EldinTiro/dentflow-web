import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { TreatmentPlanTab } from './TreatmentPlanTab'

vi.mock('../services/treatmentService', async (orig) => ({
  ...(await orig<typeof import('../services/treatmentService')>()),
  treatmentService: {
    list: vi.fn(async () => ({
      items: [{
        id: 'pl1', patientId: 'p1', title: 'QA Plan', notes: null, status: 'Draft', totalFee: 80,
        createdAt: '2026-10-22T08:00:00Z', updatedAt: null,
        items: [{ id: 'it1', treatmentPlanId: 'pl1', toothNumber: 11, surface: null, cdtCode: null, description: 'Filling', fee: 80, status: 'Planned', createdAt: '2026-10-22T08:00:00Z', updatedAt: null }],
      }],
      totalCount: 1, page: 1, pageSize: 50,
    })),
  },
}))

describe('TreatmentPlanTab', () => {
  // QA-028: the collapse / edit / delete icon buttons had no accessible name
  it('names its icon buttons', async () => {
    renderWithProviders(<TreatmentPlanTab patientId="p1" canManage />)
    await screen.findByText('QA Plan')

    for (const name of [/expand|collapse/i, /edit plan/i, /delete plan/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  // QA-020: "Kreiraj fakturu" and Bosnian toasts in an English UI; English-only labels in Bosnian
  it.each([
    ['en', '1 plan', 'Create invoice', 'Draft'],
    ['bs', '1 plan', 'Kreiraj fakturu', 'Nacrt'],
  ])('is fully translated (%s)', async (lang, count, invoice, status) => {
    await i18n.changeLanguage(lang)
    renderWithProviders(<TreatmentPlanTab patientId="p1" canManage />)

    expect(await screen.findByText(count)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: invoice })).toBeInTheDocument()
    expect(screen.getByText(status)).toBeInTheDocument()
    await i18n.changeLanguage('en')
  })
})
