import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService } from '../services/patientService'
import { PatientsPage } from './PatientsPage'

vi.mock('../services/patientService', async (orig) => ({
  ...(await orig<typeof import('../services/patientService')>()),
  patientService: { list: vi.fn() },
}))

const list = vi.mocked(patientService.list)
const row = (id: string, fullName: string, status: string) =>
  ({ id, patientNumber: id, fullName, status, dateOfBirth: null, phoneMobile: null, email: null })

// People-merge plan B7 / D11: inactive patients leave the daily list
describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({
      items: [row('P-1', 'Selma Aganović', 'Active'), row('P-2', 'Old Patient', 'Inactive')],
      totalCount: 2, page: 1, pageSize: 20, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } as never)
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: ['Receptionist'] })
  })
  afterEach(() => { useAuthStore.getState().clearAuth() })

  it('shows active patients by default, and every status on request', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PatientsPage />)
    await screen.findByText('Selma Aganović')
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Active' }))

    await user.selectOptions(screen.getByLabelText(/status filter/i), 'all')

    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'all' })))
  })

  // User request: the parent's name tells same-named patients apart (kartoteka habit)
  it("shows each patient's parent name in its own column", async () => {
    list.mockResolvedValue({
      items: [{ ...row('1943', 'Amra Abaz', 'Active'), parentName: 'Mehmed' }, row('3835', 'Emin Abdi', 'Active')],
      totalCount: 2, page: 1, pageSize: 20, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } as never)
    renderWithProviders(<PatientsPage />)

    const amra = (await screen.findByText('Amra Abaz')).closest('tr')!
    const header = screen.getByRole('columnheader', { name: 'Parent name' })
    const column = [...header.parentElement!.children].indexOf(header)
    expect(amra.children[column]).toHaveTextContent('Mehmed')
    expect(screen.getByText('Emin Abdi').closest('tr')!.children[column]).toHaveTextContent('—')
  })

  it('marks inactive rows and has no delete button on rows', async () => {
    renderWithProviders(<PatientsPage />)

    const inactive = (await screen.findByText('Old Patient')).closest('tr')!
    expect(inactive).toHaveAttribute('data-inactive', 'true')
    expect(within(inactive).getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })
})
