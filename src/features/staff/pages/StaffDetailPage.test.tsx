import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { toast } from 'sonner'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { staffService, type StaffMemberResponse, type StaffAccessSummary } from '../services/staffService'
import { StaffDetailPage } from './StaffDetailPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../services/staffService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/staffService')>()
  return {
    ...actual,
    staffService: {
      ...actual.staffService,
      getById: vi.fn(),
      grantAccess: vi.fn(),
      resetPassword: vi.fn(),
      changeRole: vi.fn(),
      changeSignInEmail: vi.fn(),
      setAccessActive: vi.fn(),
      deactivate: vi.fn(),
      reactivate: vi.fn(),
      listBlockedTimes: vi.fn(async () => []),
    },
  }
})

const svc = vi.mocked(staffService)

function staff(overrides: Partial<StaffMemberResponse> = {}): StaffMemberResponse {
  return {
    id: 's1', staffType: 'Dentist', firstName: 'Amra', lastName: 'Hadžić', fullName: 'Amra Hadžić',
    email: 'amra@x.ba', phone: null, specialty: null, colorHex: null, biography: null, licenseNumber: null,
    licenseExpiry: null, npiNumber: null, isActive: true, hireDate: null, terminationDate: null, address: null,
    city: null, postalCode: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null, isBookable: true,
    access: null, ...overrides,
  }
}

const account = (overrides: Partial<StaffAccessSummary> = {}): StaffAccessSummary => ({
  userId: 'u-amra', role: 'Staff', isActive: true, mustChangePassword: false,
  lastLoginAt: '2026-10-20T08:00:00Z', ...overrides,
})

function signIn(roles: string[], userId = 'u-owner') {
  useAuthStore.getState().setAuth('t', { userId, email: 'me@x.ba', fullName: 'Me', roles })
}

function renderPage() {
  return renderWithProviders(
    <Routes><Route path="/staff/:id" element={<StaffDetailPage />} /></Routes>,
    { route: '/staff/s1' },
  )
}

const accessSection = async () => within(await screen.findByRole('region', { name: /app access/i }))

describe('StaffDetailPage — app access (people-merge plan 4.3)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { useAuthStore.getState().clearAuth() })

  it('offers "Give access" to the owner when the person cannot sign in yet', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff())
    svc.grantAccess.mockResolvedValue({ userId: 'u-amra', tempPassword: 'Tmp-777-xyz' })
    const user = userEvent.setup()
    renderPage()

    const section = await accessSection()
    expect(section.getByText(/can't sign in yet/i)).toBeInTheDocument()
    await user.selectOptions(section.getByLabelText(/^role/i), 'ClinicOwner')
    await user.click(section.getByRole('button', { name: /give access/i }))

    expect(await screen.findByText('Tmp-777-xyz')).toBeInTheDocument()
    expect(svc.grantAccess).toHaveBeenCalledWith('s1', 'ClinicOwner')
  })

  it('shows role, last sign-in and the first-sign-in badge; resets a password after confirming', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account({ mustChangePassword: true }) }))
    svc.resetPassword.mockResolvedValue({ tempPassword: 'Tmp-888-xyz' })
    const user = userEvent.setup()
    renderPage()

    const section = await accessSection()
    expect(section.getByLabelText(/^role/i)).toHaveValue('Staff')
    expect(section.getByText(/must change password/i)).toBeInTheDocument()
    expect(section.getByText(/last sign-in/i)).toBeInTheDocument()

    await user.click(section.getByRole('button', { name: /reset password/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^reset password$/i }))

    expect(await screen.findByText('Tmp-888-xyz')).toBeInTheDocument()
    expect(svc.resetPassword).toHaveBeenCalledWith('u-amra')
  })

  it('changes the role, and shows the API refusal as a toast', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    svc.changeRole.mockRejectedValue(fastEndpointsError('A clinic must keep at least one active owner.', 'user.LastClinicOwner', 409))
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions((await accessSection()).getByLabelText(/^role/i), 'ClinicOwner')
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /change role/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/at least one active owner/i)))
    expect(svc.changeRole).toHaveBeenCalledWith('u-amra', 'ClinicOwner')
  })

  // DT-06: one click on the dropdown made someone Clinic owner
  it('asks before changing a role, in plain words for Clinic owner, and does nothing on cancel', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    const user = userEvent.setup()
    renderPage()
    const section = await accessSection()

    await user.selectOptions(section.getByRole('combobox', { name: /^role/i }), 'ClinicOwner')
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText(/full control of the clinic/i)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: /cancel/i }))

    expect(svc.changeRole).not.toHaveBeenCalled()
    expect(section.getByRole('combobox', { name: /^role/i })).toHaveValue('Staff')
  })

  it('confirms every successful role change with a toast', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    svc.changeRole.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions((await accessSection()).getByLabelText(/^role/i), 'ClinicOwner')
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /change role/i }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/role changed/i)))
  })

  // User report: Lejla's sign-in email was wrong and could not be changed anywhere
  it("changes someone's sign-in email", async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    svc.changeSignInEmail.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()
    const section = await accessSection()

    await user.click(section.getByRole('button', { name: /change sign-in email/i }))
    const input = section.getByLabelText(/new sign-in email/i)
    expect(input).toHaveValue('amra@x.ba')
    await user.clear(input)
    await user.type(input, 'amra.hadzic@x.ba')
    await user.click(section.getByRole('button', { name: /^save email$/i }))

    await waitFor(() => expect(svc.changeSignInEmail).toHaveBeenCalledWith('u-amra', 'amra.hadzic@x.ba'))
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('amra.hadzic@x.ba'))
    expect(section.queryByLabelText(/new sign-in email/i)).not.toBeInTheDocument()
  })

  it('says so when the new sign-in email is already used', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    svc.changeSignInEmail.mockRejectedValue(fastEndpointsError('An account with this email already exists.', 'auth.EmailAlreadyExists', 409))
    const user = userEvent.setup()
    renderPage()
    const section = await accessSection()

    await user.click(section.getByRole('button', { name: /change sign-in email/i }))
    await user.clear(section.getByLabelText(/new sign-in email/i))
    await user.type(section.getByLabelText(/new sign-in email/i), 'taken@x.ba')
    await user.click(section.getByRole('button', { name: /^save email$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already used/i)))
  })

  it('does not offer to change your own sign-in email here', async () => {
    signIn(['ClinicOwner'], 'u-amra')
    svc.getById.mockResolvedValue(staff({ access: account({ role: 'ClinicOwner' }) }))
    renderPage()

    expect((await accessSection()).getByRole('button', { name: /change sign-in email/i })).toBeDisabled()
  })

  it('turns sign-in off after confirming, and back on', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    svc.setAccessActive.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click((await accessSection()).getByRole('button', { name: /turn off sign-in/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^turn off$/i }))

    await waitFor(() => expect(svc.setAccessActive).toHaveBeenCalledWith('u-amra', false))
  })

  it('does not let you change your own role or sign-in here', async () => {
    signIn(['ClinicOwner'], 'u-amra')
    svc.getById.mockResolvedValue(staff({ access: account({ role: 'ClinicOwner' }) }))
    renderPage()

    const section = await accessSection()
    expect(section.getByLabelText(/^role/i)).toBeDisabled()
    expect(section.getByRole('button', { name: /turn off sign-in/i })).toBeDisabled()
    expect(section.getByText(/my profile/i)).toBeInTheDocument()
  })

  it('is read-only without people.manage', async () => {
    signIn(['Staff'])
    svc.getById.mockResolvedValue(staff({ access: account() }))
    renderPage()

    const section = await accessSection()
    expect(section.getByText(/can sign in/i)).toBeInTheDocument()
    expect(section.queryByRole('button')).not.toBeInTheDocument()
    expect(section.queryByRole('combobox')).not.toBeInTheDocument()
    // DT-34: colleagues' role and last sign-in are for the owner
    expect(section.queryByText(/last sign-in/i)).not.toBeInTheDocument()
    expect(section.queryByText('Staff')).not.toBeInTheDocument()
  })
})

describe('StaffDetailPage — deactivate instead of delete (people-merge plan B7)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { useAuthStore.getState().clearAuth() })

  it('lets the owner deactivate after confirming', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff())
    svc.deactivate.mockResolvedValue(staff({ isActive: false }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /^deactivate$/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(svc.deactivate).toHaveBeenCalledWith('s1'))
  })

  it('says how many upcoming appointments block deactivation', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff())
    svc.deactivate.mockRejectedValue(Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, errors: [
        { name: 'staff.HasUpcomingAppointments', reason: 'x' },
        { name: 'staff.HasUpcomingAppointments.count', reason: '3' },
      ] } },
    }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /^deactivate$/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/3 upcoming appointments/i)))
  })

  it('offers Reactivate on an inactive profile', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ isActive: false }))
    svc.reactivate.mockResolvedValue(staff())
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /reactivate/i }))

    await waitFor(() => expect(svc.reactivate).toHaveBeenCalledWith('s1'))
    expect(screen.queryByRole('button', { name: /^deactivate$/i })).not.toBeInTheDocument()
  })

  it('shows neither to other roles', async () => {
    signIn(['Staff'])
    svc.getById.mockResolvedValue(staff())
    renderPage()

    await screen.findByRole('heading', { name: 'Amra Hadžić' })
    expect(screen.queryByRole('button', { name: /deactivate|reactivate/i })).not.toBeInTheDocument()
  })
})

describe('StaffDetailPage — tab from the URL', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => useAuthStore.getState().clearAuth())

  // The dashboard's "who is away" links straight to the person's absences
  it('opens the absence tab for ?tab=absence', async () => {
    signIn(['Staff'])
    svc.getById.mockResolvedValue(staff())
    renderWithProviders(
      <Routes><Route path="/staff/:id" element={<StaffDetailPage />} /></Routes>,
      { route: '/staff/s1?tab=absence' },
    )

    expect(await screen.findByText('Show past absences')).toBeInTheDocument()
    expect(svc.listBlockedTimes).toHaveBeenCalled()
  })
})

describe('StaffDetailPage — naming (DT-22)', () => {
  afterEach(() => { useAuthStore.getState().clearAuth() })

  it('shows the staff type translated, not the raw English label', async () => {
    signIn(['ClinicOwner'])
    svc.getById.mockResolvedValue(staff({ staffType: 'DentalAssistant' }))
    renderPage()

    expect((await screen.findAllByText('Dental technician')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Dental Assistant')).not.toBeInTheDocument()
  })
})
