import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { staffService, type StaffMemberResponse, type StaffAccessSummary } from '../services/staffService'
import { StaffPage } from './StaffPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../services/staffService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/staffService')>()
  return { ...actual, staffService: { ...actual.staffService, list: vi.fn(), delete: vi.fn() } }
})

const svc = vi.mocked(staffService)

let n = 0
function member(name: string, access: Partial<StaffAccessSummary> | null, isActive = true): StaffMemberResponse {
  n += 1
  return {
    id: `s${n}`, staffType: 'Dentist', firstName: name, lastName: 'X', fullName: `${name} X`, email: null, phone: null,
    specialty: null, colorHex: null, biography: null, licenseNumber: null, licenseExpiry: null, npiNumber: null,
    isActive, hireDate: null, terminationDate: null, address: null, city: null, postalCode: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: null, isBookable: isActive,
    access: access && { userId: `u${n}`, role: 'Staff', isActive: true, mustChangePassword: false, lastLoginAt: null, ...access },
  }
}

function signIn(roles: string[]) {
  useAuthStore.getState().setAuth('t', { userId: 'me', email: 'me@x.ba', fullName: 'Me', roles })
}

const rowOf = async (name: string) => (await screen.findByText(`${name} X`)).closest('tr')!

describe('StaffPage (people-merge plan 4.4, B7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list.mockResolvedValue({
      items: [
        member('Nada', null),
        member('Aida', {}),
        member('Emir', { mustChangePassword: true }),
        member('Kenan', { isActive: false }),
        member('Lejla', null, false),
      ],
      totalCount: 5, page: 1, pageSize: 20,
    })
  })
  afterEach(() => { useAuthStore.getState().clearAuth() })

  // User request 2026-11-13: no Status or Access columns and no quick filters, only search
  it('has only the search, with no status or access columns', async () => {
    signIn(['ClinicOwner'])
    renderWithProviders(<StaffPage />)
    await rowOf('Nada')

    expect(screen.getByRole('textbox', { name: 'Search staff' })).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /status/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /access/i })).not.toBeInTheDocument()
  })

  // With no status filter, nobody may become unreachable: everyone is listed, an inactive
  // person marked by the name so they can still be reactivated
  it('lists everyone, marking an inactive person by the name', async () => {
    signIn(['ClinicOwner'])
    renderWithProviders(<StaffPage />)

    expect(within(await rowOf('Lejla')).getByText('Inactive')).toBeInTheDocument()
    expect(within(await rowOf('Nada')).queryByText('Inactive')).not.toBeInTheDocument()
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: 'all' }))
  })

  it('searches from a named box', async () => {
    signIn(['ClinicOwner'])
    const user = userEvent.setup()
    renderWithProviders(<StaffPage />)
    await rowOf('Nada')

    await user.type(screen.getByRole('textbox', { name: 'Search staff' }), 'na')

    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'na' })))
  })

  it('hides "+ Add Staff" and row actions from other roles', async () => {
    signIn(['Staff'])
    renderWithProviders(<StaffPage />)
    await rowOf('Nada')

    expect(screen.queryByRole('button', { name: /add staff/i })).not.toBeInTheDocument()
    expect(within(await rowOf('Nada')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('explains why a profile with appointments can’t be deleted', async () => {
    signIn(['ClinicOwner'])
    svc.delete.mockRejectedValue(fastEndpointsError('x', 'staff.HasHistory', 409))
    const user = userEvent.setup()
    renderWithProviders(<StaffPage />)

    await user.click(within(await rowOf('Nada')).getByTitle('Delete'))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/deactivate it instead/i)))
  })
})
