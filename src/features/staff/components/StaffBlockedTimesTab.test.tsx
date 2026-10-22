import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { StaffBlockedTimesTab } from './StaffBlockedTimesTab'

vi.mock('../services/staffService', () => ({
  staffService: { listBlockedTimes: vi.fn(async () => []) },
}))

describe('StaffBlockedTimesTab', () => {
  afterEach(() => {
    vi.useRealTimers()
    useAuthStore.getState().clearAuth()
  })

  // QA-008: between 00:00 and 02:00 local the absence date defaulted to yesterday
  it('defaults a new absence to the local date, not the UTC one', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T23:11:00Z')) // 22 Oct 01:11 in Sarajevo
    useAuthStore.getState().setAuth('t', { userId: 'u1', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<StaffBlockedTimesTab staffId="s1" />)

    fireEvent.click(screen.getByRole('button', { name: /add absence/i }))

    const dates = screen.getAllByDisplayValue('2026-10-22')
    expect(dates.length).toBeGreaterThanOrEqual(1)
  })

  // QA-024: an invalid period ("Nevažeći period") still let you confirm
  it('disables confirm while the period is invalid', () => {
    useAuthStore.getState().setAuth('t', { userId: 'u1', email: 'o@x', fullName: 'Owner', roles: ['ClinicOwner'] })
    renderWithProviders(<StaffBlockedTimesTab staffId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: /add absence/i }))
    const [from] = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)

    fireEvent.change(from, { target: { value: '2099-12-31' } })

    expect(screen.getByText(/invalid period/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm absence/i })).toBeDisabled()
  })
})
