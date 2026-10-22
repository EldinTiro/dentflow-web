import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { ChangePasswordRequiredPage } from './ChangePasswordRequiredPage'
import { userService } from '../services/userService'
import { refreshAccessToken } from '@/shared/api/client'

vi.mock('../services/userService', () => ({ userService: { changePassword: vi.fn() } }))
vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  refreshAccessToken: vi.fn(),
}))

describe('ChangePasswordRequiredPage', () => {
  afterEach(() => vi.clearAllMocks())

  // QA-011: after replacing the temp password the session needs a token without the claim
  it('changes the password, refreshes the session and continues into the app', async () => {
    vi.mocked(userService.changePassword).mockResolvedValue({} as never)
    vi.mocked(refreshAccessToken).mockResolvedValue('new-token')
    renderWithProviders(
      <Routes>
        <Route path="/change-password" element={<ChangePasswordRequiredPage />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>,
      { route: '/change-password' },
    )
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Current password'), 'Tmp_abc!A1')
    await user.type(screen.getByLabelText('New password'), 'MyOwnSecret123!')
    await user.type(screen.getByLabelText('Confirm new password'), 'MyOwnSecret123!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument())
    expect(userService.changePassword).toHaveBeenCalledWith({ currentPassword: 'Tmp_abc!A1', newPassword: 'MyOwnSecret123!' })
    expect(refreshAccessToken).toHaveBeenCalled()
  })
})
