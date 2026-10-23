import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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

    expect(screen.queryByLabelText(/^role/i)).not.toBeInTheDocument()
    await fillName(user)
    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(create.mock.calls[0][0]).not.toHaveProperty('access')
  })

  it('with "Can sign in" on, asks for a role and an email', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)
    await fillName(user)

    await user.click(screen.getByRole('checkbox', { name: /can sign in/i }))

    const role = screen.getByLabelText(/^role/i) as HTMLSelectElement
    expect([...role.options].map((o) => o.value)).toEqual(['ClinicOwner', 'Dentist', 'DentalNurse', 'Receptionist'])
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
    await user.click(screen.getByRole('checkbox', { name: /can sign in/i }))
    await user.selectOptions(screen.getByLabelText(/^role/i), 'Dentist')

    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    expect(await screen.findByText('Tmp-123-abc')).toBeInTheDocument()
    expect(create.mock.calls[0][0]).toMatchObject({ email: 'ana@x.ba', access: { role: 'Dentist' } })
    expect(onClose).not.toHaveBeenCalled()
  })

  // Staff.AlreadyExists: another profile; Auth.EmailAlreadyExists: an account (any clinic)
  it.each(['staff.AlreadyExists', 'auth.EmailAlreadyExists'])('shows "email already used" under the email field for %s', async (code) => {
    create.mockRejectedValue(fastEndpointsError('Email already exists.', code, 409))
    const user = userEvent.setup()
    renderWithProviders(<CreateStaffDrawer onClose={vi.fn()} />)
    await fillName(user)
    await user.type(screen.getByLabelText(/^email/i), 'ana@x.ba')

    await user.click(screen.getByRole('button', { name: /add staff member/i }))

    expect(await screen.findByText(/already used by someone/i)).toBeInTheDocument()
  })
})
