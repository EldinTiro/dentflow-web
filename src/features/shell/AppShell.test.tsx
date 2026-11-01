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

  // People-merge plan 4.5 (D5): Team merged into Staff — one list of people
  it.each(['ClinicOwner', 'Dentist', 'DentalNurse', 'Receptionist'])('has no Team link for %s', (role) => {
    renderAs(role)
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Staff' })).toHaveAttribute('href', '/staff')
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

describe('AppShell finance link', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // Finance (revenue, ledger, cash-up, debtors) is clinic-level money: finance.view only
  it('links Finance for the owner', () => {
    renderAs('ClinicOwner')
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('href', '/finance')
  })

  it('does not link Finance for a receptionist', () => {
    renderAs('Receptionist')
    expect(screen.queryByRole('link', { name: 'Finance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Billing' })).not.toBeInTheDocument()
  })
})

// User request: profile apart from clinic settings; the person is a menu top right
describe('AppShell account and settings', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('puts the account menu in the header, not name and sign-out in the sidebar', () => {
    renderAs('Dentist')
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Profile & Settings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('gives the owner one Settings link, which holds the service types', () => {
    renderAs('ClinicOwner')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('link', { name: 'Types of Services' })).not.toBeInTheDocument()
  })

  it('has no Settings link for a receptionist', () => {
    renderAs('Receptionist')
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })
})
