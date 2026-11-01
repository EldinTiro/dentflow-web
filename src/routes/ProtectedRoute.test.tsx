import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { ProtectedRoute } from './ProtectedRoute'

function renderAt(route: string) {
  renderWithProviders(
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="/change-password" element={<p>change password screen</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

const signIn = (mustChangePassword: boolean) => {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: ['Staff'], mustChangePassword })
  useAuthStore.getState().finishRestoring()
}

describe('ProtectedRoute', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // QA-011: a temporary password gave full access
  it('sends a user with a temporary password to the change-password screen', () => {
    signIn(true)
    renderAt('/dashboard')
    expect(screen.getByText('change password screen')).toBeInTheDocument()
  })

  it('lets everyone else through', () => {
    signIn(false)
    renderAt('/dashboard')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
