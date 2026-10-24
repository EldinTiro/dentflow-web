import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { LoginForm } from './LoginForm'
import { login } from '../services/authService'

vi.mock('../services/authService', () => ({ login: vi.fn() }))

async function submit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), 'pink@dentflow.local')
  await user.type(screen.getByLabelText('Password'), 'secret')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset()
  })

  // QA-002: a suspended clinic must be told why, not "invalid password"
  it('shows the server reason when the clinic is suspended (403)', async () => {
    vi.mocked(login).mockRejectedValue(
      fastEndpointsError("This clinic's account is suspended. Please contact DentFlow support.", 'Tenant.Inactive', 403),
    )
    renderWithProviders(<LoginForm />)

    await submit()

    expect(await screen.findByText(/account is suspended/i)).toBeInTheDocument()
  })

  it('keeps the generic message for bad credentials (401)', async () => {
    vi.mocked(login).mockRejectedValue(Object.assign(new Error('401'), { isAxiosError: true, response: { status: 401, data: '' } }))
    renderWithProviders(<LoginForm />)

    await submit()

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    // Announced to screen readers, not just shown
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
  })

  // DR-20: tabIndex={-1} hid the reveal toggle from keyboard users
  it('lets keyboard users reach the show-password toggle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.click(screen.getByLabelText('Password'))
    await user.tab()

    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
  })
})
