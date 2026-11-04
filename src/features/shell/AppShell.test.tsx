import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
vi.mock('@/features/appointments/services/appointmentService', () => ({
  appointmentService: {
    // Today: three visits still on, one cancelled
    list: vi.fn(async () => ({
      items: ['Scheduled', 'CheckedIn', 'Completed', 'Cancelled'].map((status, i) => ({ id: `a${i}`, status })),
      totalCount: 4, page: 1, pageSize: 50,
    })),
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getCurrent: vi.fn(() => new Promise(() => {})),
    getFeatures: vi.fn(() => new Promise(() => {})),
  },
}))

function renderAs(role: string) {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'Pink Owner', roles: [role] })
  renderWithProviders(<ThemeProvider><AppShell /></ThemeProvider>, { route: '/dashboard' })
}

describe('AppShell navigation', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // People-merge plan 4.5 (D5): Team merged into Staff — one list of people
  it.each(['ClinicOwner', 'Staff'])('has no Team link for %s', (role) => {
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
    renderAs('Staff')
    expect(screen.queryByRole('link', { name: 'Finance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Billing' })).not.toBeInTheDocument()
  })
})

// User request: profile apart from clinic settings; the person is a menu top right
describe('AppShell account and settings', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('puts the account menu in the header, not name and sign-out in the sidebar', () => {
    renderAs('Staff')
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
    renderAs('Staff')
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })
})

// Sidebar mock A: daily work apart from running the clinic, today's count, who is signed in
describe('AppShell grouped sidebar', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  const linksIn = (group: string) =>
    within(screen.getByRole('group', { name: group })).getAllByRole('link').map((l) => l.getAttribute('href'))

  it('puts the daily pages first and the clinic pages apart, for the owner', () => {
    renderAs('ClinicOwner')
    expect(linksIn('Every day')).toEqual(['/dashboard', '/appointments', '/patients'])
    expect(linksIn('Clinic')).toEqual(['/staff', '/finance', '/settings'])
  })

  it('gives the staff only Staff under Clinic', () => {
    renderAs('Staff')
    expect(linksIn('Clinic')).toEqual(['/staff'])
  })

  it("counts today's appointments that are still on, beside Appointments", async () => {
    renderAs('Staff')
    const link = screen.getByRole('link', { name: /^Appointments/ })
    await waitFor(() => expect(link).toHaveAccessibleName('Appointments 3 today'))
  })

  it('shows who is signed in at the bottom, linking to their profile', () => {
    renderAs('ClinicOwner')
    const me = screen.getByRole('link', { name: /Pink Owner/ })
    expect(me).toHaveAttribute('href', '/profile')
    expect(me).toHaveTextContent('PO')
    expect(me).toHaveTextContent('Administrator')
  })
})
