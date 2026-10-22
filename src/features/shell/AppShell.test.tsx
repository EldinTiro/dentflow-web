import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { userService } from '@/features/auth/services/userService'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { AppShell } from './AppShell'

vi.mock('@/features/auth/services/userService', () => ({
  userService: {
    getPreferences: vi.fn(async () => ({ theme: 'light', language: 'en', timeFormat: '24h', defaultCalendarView: 'week' })),
    updatePreferences: vi.fn(async () => undefined),
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getCurrent: vi.fn(() => new Promise(() => {})),
    getFeatures: vi.fn(() => new Promise(() => {})),
  },
}))

function renderAs(role: string) {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'U', roles: [role] })
  renderWithProviders(<ThemeProvider><AppShell /></ThemeProvider>, { route: '/dashboard' })
}

describe('AppShell navigation', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // QA-022: the Team page was reachable only by typing its URL
  it('links the Team page for clinic owners and admins', () => {
    renderAs('ClinicOwner')
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/settings/users')
  })

  it('does not link it for other roles', () => {
    renderAs('Receptionist')
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument()
  })

  // QA-021: the saved preference said Light while the app was dark (clock / local toggle won)
  it('applies the saved theme preference', async () => {
    localStorage.setItem('theme', 'dark')
    renderAs('ClinicOwner')

    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
  })

  it('saves the header toggle to the preference', async () => {
    renderAs('ClinicOwner')
    await waitFor(() => expect(userService.getPreferences).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: /dark mode/i }))

    await waitFor(() => expect(userService.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' })))
  })

  // QA-028: the language switcher was an unnamed button
  it('names the language switcher', () => {
    renderAs('ClinicOwner')
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument()
  })
})
