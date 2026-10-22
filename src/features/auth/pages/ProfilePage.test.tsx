import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
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

describe('ProfilePage notifications tab', () => {
  afterEach(async () => {
    useAuthStore.getState().clearAuth()
    await i18n.changeLanguage('en')
  })

  // DR-11: the plan upsell was a hard-coded Bosnian sentence in every language
  it.each([
    ['en', 'Notifications', 'SMS reminders are available on the Pro and Enterprise plans.'],
    ['de', 'Benachrichtigungen', 'SMS-Erinnerungen sind in den Tarifen Pro und Enterprise verfügbar.'],
  ])('shows the SMS upsell in the UI language (%s)', async (lang, tabName, upsell) => {
    await i18n.changeLanguage(lang)
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'p@x', fullName: 'Pink Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<ThemeProvider><ProfilePage /></ThemeProvider>)

    await userEvent.click(screen.getByRole('button', { name: tabName }))

    expect(await screen.findByText(upsell)).toBeInTheDocument()
  })
})
