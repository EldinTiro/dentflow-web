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
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: { getCurrent: vi.fn(() => new Promise(() => {})), getFeatures: vi.fn(() => new Promise(() => {})) },
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
})
