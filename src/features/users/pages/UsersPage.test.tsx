import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { UsersPage } from './UsersPage'

vi.mock('../services/userService', () => ({
  userService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'owner', fullName: 'Clinic Owner', email: 'o@x', role: 'ClinicOwner', isActive: true, lastLoginAt: null },
        { id: 'admin', fullName: 'Clinic Admin', email: 'a@x', role: 'ClinicAdmin', isActive: true, lastLoginAt: null },
        { id: 'rec', fullName: 'Front Desk', email: 'r@x', role: 'Receptionist', isActive: true, lastLoginAt: null },
      ],
      totalCount: 3, page: 1, pageSize: 20,
    })),
  },
}))

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement

function renderAs(userId: string, role: string) {
  useAuthStore.getState().setAuth('t', { userId, email: 'x@x', fullName: 'Me', roles: [role] })
  renderWithProviders(<UsersPage />)
}

describe('Team UsersPage', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // QA-012: the only owner could deactivate or demote themselves
  it('locks your own row', async () => {
    renderAs('owner', 'ClinicOwner')
    await screen.findByText('Front Desk')

    expect(within(row('Clinic Owner')).getByRole('combobox')).toBeDisabled()
    expect(within(row('Clinic Owner')).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
  })

  // QA-012: a ClinicAdmin could demote/deactivate the owner and promote to owner
  it('does not let a ClinicAdmin touch the owner or grant the owner role', async () => {
    renderAs('admin', 'ClinicAdmin')
    await screen.findByText('Front Desk')

    expect(within(row('Clinic Owner')).getByRole('combobox')).toBeDisabled()
    expect(within(row('Clinic Owner')).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    const options = within(within(row('Front Desk')).getByRole('combobox')).getAllByRole('option')
    expect(options.map((o) => (o as HTMLOptionElement).value)).not.toContain('ClinicOwner')
  })
})
