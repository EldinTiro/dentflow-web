import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { tenantService } from '@/features/admin/services/tenantService'
import { SettingsLayout } from './SettingsLayout'
import { ClinicHoursPage } from './ClinicHoursPage'
import { NotificationSettingsPage } from './NotificationSettingsPage'
import { PlanPage } from './PlanPage'

vi.mock('@/features/admin/services/tenantService', () => ({
  tenantService: {
    getCurrent: vi.fn(async () => ({ name: 'Pink Dent', plan: 'Free', planExpiresAt: null })),
    // Free plan: no SmsNotifications flag, so the upsell shows
    getFeatures: vi.fn(async () => ({ flags: [], quotas: { MaxStaffCount: 3, StorageLimitGb: 1 } })),
    getSettings: vi.fn(async () => ({ weeklyScheduleJson: null, slotDurationMinutes: 30 })),
    updateSettings: vi.fn(async (body: unknown) => body),
    getNotificationConfig: vi.fn(async () => ({ smsEnabled: false, reminder1HoursBefore: null, reminder2HoursBefore: null })),
  },
}))

function renderAt(route: string) {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'p@x', fullName: 'Pink Owner', roles: ['ClinicOwner'] })
  return renderWithProviders(
    <Routes>
      <Route path="/settings" element={<SettingsLayout />}>
        <Route path="hours" element={<ClinicHoursPage />} />
        <Route path="notifications" element={<NotificationSettingsPage />} />
        <Route path="plan" element={<PlanPage />} />
      </Route>
    </Routes>,
    { route },
  )
}

// User request: clinic settings in one place, apart from the personal profile
describe('Clinic settings', () => {
  afterEach(async () => {
    useAuthStore.getState().clearAuth()
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
  })

  it('lists every clinic setting in its own menu', async () => {
    renderAt('/settings/hours')

    expect(screen.getByRole('heading', { name: 'Clinic settings', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Working hours' })).toHaveAttribute('href', '/settings/hours')
    expect(screen.getByRole('link', { name: 'Types of Services' })).toHaveAttribute('href', '/settings/appointment-types')
    expect(screen.getByRole('link', { name: 'SMS reminders' })).toHaveAttribute('href', '/settings/notifications')
    expect(screen.getByRole('link', { name: 'Subscription Plan' })).toHaveAttribute('href', '/settings/plan')
  })

  it('saves the working hours and slot length', async () => {
    renderAt('/settings/hours')
    await screen.findByText('Monday')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(tenantService.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ slotDurationMinutes: 30, weeklyScheduleJson: expect.stringContaining('monday') })))
  })

  // DR-11: the plan upsell was a hard-coded Bosnian sentence in every language
  it.each([
    ['en', 'SMS reminders are available on the Pro and Enterprise plans.'],
    ['de', 'SMS-Erinnerungen sind in den Tarifen Pro und Enterprise verfügbar.'],
  ])('shows the SMS upsell in the UI language (%s)', async (lang, upsell) => {
    await i18n.changeLanguage(lang)
    renderAt('/settings/notifications')

    expect(await screen.findByText(upsell)).toBeInTheDocument()
  })

  it("shows the clinic's plan and its limits", async () => {
    renderAt('/settings/plan')

    expect(await screen.findByText('Free')).toBeInTheDocument()
    expect(await screen.findByText(/3/)).toBeInTheDocument()
  })
})
