import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { staffService } from '../services/staffService'
import { CreateStaffDrawer } from './CreateStaffDrawer'

vi.mock('../services/staffService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/staffService')>()
  return { ...actual, staffService: { ...actual.staffService, create: vi.fn() } }
})

const create = vi.mocked(staffService.create)

async function fillName(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Ana')
  await user.type(screen.getByLabelText(/last name/i), 'Babić')
}

// People-merge plan 4.2: a person is added once; signing in is a switch on the same form
describe('CreateStaffDrawer', () => {
  beforeEach(() => { create.mockReset() })

  it('adds a person without access by default: no role, email optional', async () => {
    create.mockResolvedValue({ id: 's1' } as never)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={onClose} />)

    expect(screen.queryByRole('radiogroup', { name: 'Role' })).not.toBeInTheDocument()
    await fillName(user)
    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(create.mock.calls[0][0]).not.toHaveProperty('access')
  })

  it('with "Can sign in" on, asks for a role and an email', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)
    await fillName(user)

    await user.click(screen.getByRole('switch', { name: /can sign in/i }))

    // Two roles, named for what they may do: Administrator and Staff (2026-11-02)
    const role = screen.getByRole('radiogroup', { name: 'Role' })
    expect(within(role).getAllByRole('radio').map((o) => o.textContent)).toEqual(['Administrator', 'Staff'])
    expect(within(role).getByRole('radio', { name: 'Staff' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    expect(await screen.findByText(/email is needed to sign in/i)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the temporary password once the person is added with access', async () => {
    create.mockResolvedValue({ id: 's1', email: 'ana@x.ba', tempPassword: 'Tmp-123-abc' } as never)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={onClose} />)
    await fillName(user)
    await user.type(screen.getByLabelText(/^email/i), 'ana@x.ba')
    await user.click(screen.getByRole('switch', { name: /can sign in/i }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Role' })).getByRole('radio', { name: 'Administrator' }))

    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    expect(await screen.findByText('Tmp-123-abc')).toBeInTheDocument()
    expect(create.mock.calls[0][0]).toMatchObject({ email: 'ana@x.ba', access: { role: 'ClinicOwner' } })
    expect(onClose).not.toHaveBeenCalled()
  })

  // Staff.AlreadyExists: another profile; Auth.EmailAlreadyExists: an account (any clinic)
  it.each(['staff.AlreadyExists', 'auth.EmailAlreadyExists', 'user.EmailAlreadyExists'])('shows "email already used" under the email field for %s', async (code) => {
    create.mockRejectedValue(fastEndpointsError('Email already exists.', code, 409))
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)
    await fillName(user)
    await user.type(screen.getByLabelText(/^email/i), 'ana@x.ba')

    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    expect(await screen.findByText(/already used by someone/i)).toBeInTheDocument()
  })

  // 2026-11-02: two roles; whatever the job, a new colleague signs in as Staff unless
  // the Administrator deliberately makes them an Administrator
  it.each(['Dentist', 'DentalAssistant', 'Receptionist'])('suggests Staff for a %s', async (staffType) => {
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)

    await user.click(within(screen.getByRole('radiogroup', { name: 'Staff type' })).getByRole('radio', { name: new RegExp(`^${{ Dentist: 'Dentist', DentalAssistant: 'Dental technician', Receptionist: 'Receptionist' }[staffType]}$`) }))
    await user.click(screen.getByRole('switch', { name: /can sign in/i }))

    expect(within(screen.getByRole('radiogroup', { name: 'Role' })).getByRole('radio', { name: 'Staff' })).toHaveAttribute('aria-checked', 'true')
  })

  // DT-22: retired names (Hygienist, Clinic admin) were still offered
  it('offers the current staff types only, with the role-aligned name', () => {
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)

    const types = within(screen.getByRole('radiogroup', { name: 'Staff type' })).getAllByRole('radio').map((o) => o.textContent)
    expect(types).toEqual(['Dentist', 'Dental technician', 'Receptionist', 'Office manager'])
  })

  // User request 2026-11-13: laid out like the rest of the app — named groups, no drop-downs,
  // the colour picked from the calendar's swatches, the buttons always in view
  it('groups the form, with no drop-downs, and saves the colour picked', async () => {
    create.mockResolvedValue({ id: 's1' } as never)
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)

    for (const name of ['Person', 'Contact', 'Work', 'App access']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await fillName(user)
    await user.click(within(screen.getByRole('radiogroup', { name: 'Calendar colour' })).getByRole('radio', { name: '#10B981' }))
    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    await waitFor(() => expect(create.mock.calls[0][0]).toMatchObject({ colorHex: '#10B981' }))
  })
})
