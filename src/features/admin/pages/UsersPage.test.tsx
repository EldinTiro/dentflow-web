import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { UsersPage } from './UsersPage'
import { userAdminService, type UserAdminResponse } from '../services/userAdminService'

const user = (o: Partial<UserAdminResponse>): UserAdminResponse => ({
  id: 'x', email: 'x@x', fullName: 'X', firstName: 'X', lastName: 'X', role: 'Staff',
  tenantId: null, isActive: true, lastLoginAt: null, createdAt: '2026-10-01T00:00:00Z', ...o,
})

vi.mock('../services/userAdminService', () => ({
  userAdminService: {
    list: vi.fn(async () => ({
      items: [
        user({ id: 'me', fullName: 'Platform Admin', role: 'SuperAdmin' }),
        user({ id: 'r1', fullName: 'Clinic Receptionist', role: 'Staff', tenantId: 't1' }),
      ],
      totalCount: 2, page: 1, pageSize: 20,
    })),
    updateStatus: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => ({ tempPassword: 'Tmp_x' })),
  },
}))
vi.mock('../services/tenantService', () => ({
  tenantService: { list: vi.fn(async () => ({ items: [], totalCount: 0 })) },
}))

function row(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

describe('Admin UsersPage', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  function renderAsAdmin() {
    useAuthStore.getState().setAuth('t', { userId: 'me', email: 'a@x', fullName: 'Platform Admin', roles: ['SuperAdmin'] })
    renderWithProviders(<UsersPage />)
  }

  // QA-012: one click locked the only platform admin out
  it('offers no deactivate or role change on your own row', async () => {
    renderAsAdmin()
    await screen.findByText('Clinic Receptionist')

    const mine = row('Platform Admin')
    expect(within(mine).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    expect(within(mine).getByRole('combobox')).toBeDisabled()
  })

  // QA-012: one select change made a clinic user a platform admin
  it('does not offer SuperAdmin for clinic users', async () => {
    renderAsAdmin()
    await screen.findByText('Clinic Receptionist')

    const options = within(within(row('Clinic Receptionist')).getByRole('combobox')).getAllByRole('option')
    expect(options.map((o) => (o as HTMLOptionElement).value)).not.toContain('SuperAdmin')
  })

  // QA-013: Deactivate and Reset pwd acted on a single click
  it('asks before deactivating a user or resetting their password', async () => {
    renderAsAdmin()
    const user = userEvent.setup()
    await screen.findByText('Clinic Receptionist')
    const receptionist = within(row('Clinic Receptionist'))

    await user.click(receptionist.getByRole('button', { name: 'Deactivate' }))
    await user.click(receptionist.getByRole('button', { name: 'Reset password' }))
    expect(userAdminService.updateStatus).not.toHaveBeenCalled()
    expect(userAdminService.resetPassword).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset password' }))
    await waitFor(() => expect(userAdminService.resetPassword).toHaveBeenCalledWith('r1'))
  })
})
