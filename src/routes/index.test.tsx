import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { AppRouter } from './index'

vi.mock('@/features/auth/services/userService', () => ({
  userService: {
    getPreferences: vi.fn(async () => ({ theme: 'light', language: 'en', timeFormat: '24h', defaultCalendarView: 'week' })),
    updatePreferences: vi.fn(async () => undefined),
    getProfile: vi.fn(async () => ({ firstName: 'Alma', lastName: 'Trako', email: 'o@x' })),
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getCurrent: vi.fn(() => new Promise(() => {})),
    getFeatures: vi.fn(() => new Promise(() => {})),
    getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })),
  },
}))
vi.mock('@/features/staff/services/staffService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/staff/services/staffService')>()
  return {
    ...actual,
    staffService: { ...actual.staffService, list: vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 })) },
  }
})

describe('routes', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // People-merge plan 4.5 (D5): old bookmarks of the Team page land on Staff
  it('redirects /settings/users to /staff', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><AppRouter /></ThemeProvider>, { route: '/settings/users' })

    expect(await screen.findByRole('heading', { name: 'Staff', level: 1 })).toBeInTheDocument()
  })

  // User request: profile and clinic settings are two places now; old links still land
  it.each([
    ['/settings/profile', 'My profile'],
    ['/settings/profile?tab=appearance', 'My profile'],
    ['/settings/profile?tab=clinic', 'Clinic settings'],
    ['/settings/profile?tab=notifications', 'Clinic settings'],
    ['/settings', 'Clinic settings'],
  ])('opens %s on the right page', async (route, heading) => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><AppRouter /></ThemeProvider>, { route })

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
  })

  it('opens working hours first in the clinic settings', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><AppRouter /></ThemeProvider>, { route: '/settings' })

    expect(await screen.findByRole('link', { name: 'Working hours' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps clinic settings to the owner', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'r@x', fullName: 'Desk', roles: ['Staff'] })
    renderWithProviders(<ThemeProvider><AppRouter /></ThemeProvider>, { route: '/settings/hours' })

    expect(await screen.findByRole('alert')).toHaveTextContent(/access/i)
  })
})
