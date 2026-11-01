import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { logout } from '@/features/auth/services/authService'
import { UserMenu, initialsOf } from './UserMenu'

vi.mock('@/features/auth/services/authService', () => ({ logout: vi.fn() }))

function renderAs(fullName: string, role: string) {
  useAuthStore.getState().setAuth('t', { userId: 'u', email: 'alma@pinkdent.ba', fullName, roles: [role] })
  renderWithProviders(<UserMenu />)
}

// User request: profile apart from settings, the signed-in person shown as initials (top right)
describe('UserMenu', () => {
  afterEach(() => { useAuthStore.getState().clearAuth(); vi.clearAllMocks() })

  it('shows the initials of the signed-in person', () => {
    renderAs('Alma Trako', 'ClinicOwner')

    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('AT')
  })

  it('opens a menu with who is signed in, their profile and sign out', async () => {
    renderAs('Alma Trako', 'Dentist')

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Alma Trako')).toBeInTheDocument()
    expect(screen.getByText('alma@pinkdent.ba')).toBeInTheDocument()
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'My profile' })).toHaveAttribute('href', '/profile')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalled()
  })

  it('offers clinic settings to the owner only', async () => {
    renderAs('Alma Trako', 'ClinicOwner')
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: 'Clinic settings' })).toHaveAttribute('href', '/settings')
  })

  it('does not offer clinic settings to a receptionist', async () => {
    renderAs('Ena Desk', 'Receptionist')
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.queryByRole('menuitem', { name: 'Clinic settings' })).not.toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    renderAs('Alma Trako', 'Dentist')
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('initialsOf', () => {
  it.each([
    ['Alma Trako', 'AT'],
    ['Lejla Drino', 'LD'],
    ['Ćamil Begić', 'ĆB'],
    ['Abdul Samed Ademi', 'AA'], // first and last name
    ['Selma', 'S'],
    ['  ', '?'],
  ])('%s → %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials)
  })
})
