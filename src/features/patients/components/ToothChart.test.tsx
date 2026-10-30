import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { toothChartService } from '../services/toothChartService'
import { ToothChart } from './ToothChart'

vi.mock('../services/toothChartService', () => ({
  toothChartService: {
    list: vi.fn(),
    add: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined),
  },
}))
vi.mock('@/features/treatments/services/treatmentService', async (orig) => ({
  ...(await orig<typeof import('@/features/treatments/services/treatmentService')>()),
  treatmentService: {
    list: vi.fn(async () => ({
      items: [{ id: 'plan', items: [{ id: 'i1', toothNumber: 46, description: 'Root canal', status: 'Planned', fee: 120 }] }],
      totalCount: 1, page: 1, pageSize: 50,
    })),
  },
}))

const finding = (id: string, tooth: number, condition: string, surfaces: string | null = null) =>
  ({ id, tooth, condition, surfaces, notes: null, recordedAt: '2026-10-29T08:00:00Z' })

const svc = vi.mocked(toothChartService)
const tooth = (n: number) => screen.getByRole('button', { name: `Tooth ${n}` })

describe('ToothChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list.mockResolvedValue([
      finding('f1', 36, 'Filling', 'MOD'),
      finding('f2', 11, 'Crown'),
      finding('f3', 47, 'Missing'),
    ])
  })

  it('draws every permanent tooth in FDI order', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)

    const upper = await screen.findByRole('group', { name: 'Upper jaw' })
    const numbers = within(upper).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(numbers.slice(0, 3)).toEqual(['Tooth 18', 'Tooth 17', 'Tooth 16'])
    expect(numbers.slice(7, 9)).toEqual(['Tooth 11', 'Tooth 21'])
    expect(within(screen.getByRole('group', { name: 'Lower jaw' })).getAllByRole('button')).toHaveLength(16)
  })

  it('shows what the chart says about each tooth', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)
    await screen.findByRole('group', { name: 'Upper jaw' })
    await vi.waitFor(() => expect(tooth(36).querySelector('[data-surface="O"]')).toHaveAttribute('data-state', 'Filling'))

    expect(tooth(36).querySelector('[data-surface="B"]')).not.toHaveAttribute('data-state')
    expect(tooth(11)).toHaveAttribute('data-conditions', 'Crown')
    expect(tooth(47)).toHaveAttribute('data-missing', 'true')
    // Treatment still to do on 46
    await vi.waitFor(() => expect(tooth(46)).toHaveAttribute('data-plan', 'planned'))
  })

  it('lists the findings and planned work of the chosen tooth', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)
    await vi.waitFor(() => expect(tooth(46)).toHaveAttribute('data-plan', 'planned'))

    await userEvent.click(tooth(36))
    const panel = screen.getByRole('region', { name: 'Tooth 36' })
    expect(within(panel).getByRole('listitem')).toHaveTextContent(/Filling\s*MOD/)

    await userEvent.click(tooth(46))
    expect(within(screen.getByRole('region', { name: 'Tooth 46' })).getByText('Root canal')).toBeInTheDocument()
  })

  it('records caries on the surfaces picked', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)
    await screen.findByRole('group', { name: 'Upper jaw' })

    await userEvent.click(tooth(26))
    const panel = screen.getByRole('region', { name: 'Tooth 26' })
    await userEvent.selectOptions(within(panel).getByLabelText('Finding'), 'Caries')
    await userEvent.click(within(panel).getByRole('button', { name: 'O' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'D' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Add finding' }))

    expect(svc.add).toHaveBeenCalledWith('pat-1', { tooth: 26, condition: 'Caries', surfaces: 'OD', notes: null })
  })

  it('offers no surfaces for a whole-tooth finding', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)
    await screen.findByRole('group', { name: 'Upper jaw' })

    await userEvent.click(tooth(26))
    const panel = screen.getByRole('region', { name: 'Tooth 26' })
    await userEvent.selectOptions(within(panel).getByLabelText('Finding'), 'Crown')

    expect(within(panel).queryByRole('button', { name: 'O' })).not.toBeInTheDocument()
  })

  it('removes a finding', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit />)
    await vi.waitFor(() => expect(tooth(11)).toHaveAttribute('data-conditions', 'Crown'))

    await userEvent.click(tooth(11))
    await userEvent.click(within(screen.getByRole('region', { name: 'Tooth 11' })).getByRole('button', { name: 'Remove Crown' }))

    expect(svc.remove).toHaveBeenCalledWith('pat-1', 'f2')
  })

  // The desk reads the chart; clinicians write it (same as the API)
  it('is read-only for someone who may not edit it', async () => {
    renderWithProviders(<ToothChart patientId="pat-1" canEdit={false} />)
    await vi.waitFor(() => expect(tooth(11)).toHaveAttribute('data-conditions', 'Crown'))

    await userEvent.click(tooth(11))
    const panel = screen.getByRole('region', { name: 'Tooth 11' })
    expect(within(panel).queryByRole('button', { name: 'Add finding' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Remove Crown' })).not.toBeInTheDocument()
  })
})
