import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { ProfilePage } from './ProfilePage'

vi.mock('@/features/auth/services/userService', () => ({
  userService: {
    getProfile: vi.fn(async () => ({ firstName: 'Pink', lastName: 'Owner', email: 'p@x' })),
    getPreferences: vi.fn(async () => ({ theme: 'light', language: 'en', timeFormat: '24h', defaultCalendarView: 'week' })),
    updatePreferences: vi.fn(async () => undefined),
    changePassword: vi.fn(),
  },
}))
vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getCurrent: vi.fn(async () => ({ name: 'Pink Dent', plan: 'Free' })),
    // Free plan: no SmsNotifications flag, so the upsell shows
    getFeatures: vi.fn(async () => ({ flags: [], quotas: { MaxStaffCount: 3 } })),
    getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })),
    getNotificationConfig: vi.fn(async () => ({ smsEnabled: false, reminders: [] })),
  },
}))

// User request: the profile is about the person; the clinic lives in Postavke klinike
describe('ProfilePage holds personal things only', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('has Profile and Appearance, even for the owner', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'p@x', fullName: 'Pink Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><ProfilePage /></ThemeProvider>, { route: '/profile' })

    expect(await screen.findByRole('heading', { name: 'My profile', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clinic' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(screen.queryByText('Subscription Plan')).not.toBeInTheDocument()
  })
})

// DT-31: a reload always went back to the Profile tab
describe('ProfilePage tabs', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  it('opens the tab named in ?tab=', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'p@x', fullName: 'Pink Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><ProfilePage /></ThemeProvider>, { route: '/profile?tab=appearance' })

    expect(await screen.findByRole('button', { name: 'Appearance' })).toHaveAttribute('aria-pressed', 'true')
  })
})
