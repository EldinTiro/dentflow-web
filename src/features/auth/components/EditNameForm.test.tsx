import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '../store/authStore'
import { EditNameForm } from './EditNameForm'
import { userService } from '../services/userService'

vi.mock('../services/userService', () => ({ userService: { updateProfile: vi.fn() } }))

describe('EditNameForm', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth()
    vi.clearAllMocks()
  })

  // QA-037: the user's own name could not be edited
  it('saves the new name and shows it in the app right away', async () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'a@x', fullName: 'Amra Hadzic', roles: ['Staff'] })
    vi.mocked(userService.updateProfile).mockResolvedValue({
      id: 'u', email: 'a@x', firstName: 'Amra', lastName: 'Hadžić', fullName: 'Amra Hadžić', avatarUrl: null, lastLoginAt: null,
    })
    renderWithProviders(<EditNameForm firstName="Amra" lastName="Hadzic" />)
    const user = userEvent.setup()

    const last = screen.getByLabelText('Last name')
    await user.clear(last)
    await user.type(last, 'Hadžić')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(userService.updateProfile).toHaveBeenCalledWith({ firstName: 'Amra', lastName: 'Hadžić' }))
    await waitFor(() => expect(useAuthStore.getState().user?.fullName).toBe('Amra Hadžić'))
  })

  it('requires both names', async () => {
    renderWithProviders(<EditNameForm firstName="Amra" lastName="Hadzic" />)
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('First name'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(userService.updateProfile).not.toHaveBeenCalled()
  })
})
