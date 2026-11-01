import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { RoleGuard } from './RoleGuard'

function renderAs(role: string) {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: [role] })
  renderWithProviders(
    <Routes>
      <Route element={<RoleGuard allowedRoles={['ClinicOwner', 'ClinicAdmin']} />}>
        <Route path="/settings/users" element={<p>team page</p>} />
      </Route>
    </Routes>,
    { route: '/settings/users' },
  )
}

describe('RoleGuard', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // QA-022: a Receptionist got an empty table (the API's 403 was swallowed)
  it('tells an unauthorised user they have no access', () => {
    renderAs('Staff')
    expect(screen.queryByText('team page')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/don.t have access/i)
  })

  it('renders the page for an allowed role', () => {
    renderAs('ClinicAdmin')
    expect(screen.getByText('team page')).toBeInTheDocument()
  })

  // Zustand 5 re-renders forever if the selector returns a new [] each time
  it('does not loop when nobody is signed in', () => {
    renderWithProviders(
      <Routes>
        <Route element={<RoleGuard allowedRoles={['ClinicOwner']} />}>
          <Route path="/x" element={<p>x</p>} />
        </Route>
      </Routes>,
      { route: '/x' },
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
