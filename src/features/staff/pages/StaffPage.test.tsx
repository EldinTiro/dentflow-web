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
    access: access && { userId: `u${n}`, role: 'Dentist', isActive: true, mustChangePassword: false, lastLoginAt: null, ...access },
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

  it('shows each person’s access in its own column', async () => {
    signIn(['ClinicOwner'])
    renderWithProviders(<StaffPage />)

    expect(within(await rowOf('Nada')).getByText('No access')).toBeInTheDocument()
    expect(within(await rowOf('Aida')).getByText('Can sign in')).toBeInTheDocument()
    expect(within(await rowOf('Emir')).getByText('Waiting for first sign-in')).toBeInTheDocument()
    expect(within(await rowOf('Kenan')).getByText('Sign-in turned off')).toBeInTheDocument()
    expect(within(await rowOf('Lejla')).getByText('Inactive')).toBeInTheDocument()
  })

  it('filters to people who have access', async () => {
    signIn(['ClinicOwner'])
    const user = userEvent.setup()
    renderWithProviders(<StaffPage />)
    await rowOf('Nada')

    await user.selectOptions(screen.getByLabelText(/access filter/i), 'with')

    expect(screen.queryByText('Nada X')).not.toBeInTheDocument()
    expect(screen.getByText('Aida X')).toBeInTheDocument()
  })

  it('asks the API for active staff by default, and for everyone on request', async () => {
    signIn(['ClinicOwner'])
    const user = userEvent.setup()
    renderWithProviders(<StaffPage />)
    await rowOf('Nada')
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: true }))

    await user.selectOptions(screen.getByLabelText(/status filter/i), 'all')

    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: 'all' })))
  })

  it('hides "+ Add Staff" and row actions from other roles', async () => {
    signIn(['Receptionist'])
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
