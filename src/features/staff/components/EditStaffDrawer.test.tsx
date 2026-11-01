import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import { staffService, type StaffMemberResponse } from '../services/staffService'
import { toast } from 'sonner'
import { EditStaffDrawer } from './EditStaffDrawer'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('../services/staffService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/staffService')>()
  return { ...actual, staffService: { ...actual.staffService, update: vi.fn(), delete: vi.fn() } }
})

const staff = (access: StaffMemberResponse['access'] = null) => ({
  id: 's1', staffType: 'Dentist', firstName: 'Amra', lastName: 'Hadžić', fullName: 'Amra Hadžić', email: 'amra@x.ba',
  phone: null, specialty: null, colorHex: null, biography: null, licenseNumber: null, licenseExpiry: null, npiNumber: null,
  isActive: true, hireDate: null, terminationDate: null, address: null, city: null, postalCode: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: null, isBookable: true, access,
}) as StaffMemberResponse

describe('EditStaffDrawer', () => {
  afterEach(() => useAuthStore.getState().clearAuth())

  // DT-20: the sign-in email was editable, and Save then failed
  it('makes the sign-in email read-only and says why', () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'O', roles: ['ClinicOwner'] })
    renderWithProviders(<EditStaffDrawer staff={staff({ userId: 'u1', role: 'Staff', isActive: true, mustChangePassword: false, lastLoginAt: null })} onClose={() => {}} />)

    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('readonly')
    expect(screen.getByText(/sign-in email/i)).toBeInTheDocument()
  })

  it('keeps the email editable for someone who cannot sign in', () => {
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'o@x', fullName: 'O', roles: ['ClinicOwner'] })
    renderWithProviders(<EditStaffDrawer staff={staff()} onClose={() => {}} />)

    expect(screen.getByLabelText(/^email/i)).not.toHaveAttribute('readonly')
  })

  // DT-22: "First Name" here, "First name" when adding
  it('uses the same labels as the add drawer', () => {
    renderWithProviders(<EditStaffDrawer staff={staff()} onClose={() => {}} />)

    expect(screen.getByLabelText(/^first name/i)).toBeInTheDocument()
    expect(screen.queryByText('First Name')).not.toBeInTheDocument()
  })

  // User report: the owner also treats patients, but her profile said "Office manager" and
  // she could not be booked. The type (what she does) is separate from her owner sign-in.
  it('lets the staff type be changed, keeping the person who it is', async () => {
    vi.mocked(staffService.update).mockResolvedValue(staff() as never)
    const owner = { ...staff({ userId: 'u1', role: 'ClinicOwner', isActive: true, mustChangePassword: false, lastLoginAt: null }), staffType: 'OfficeManager', isBookable: false } as StaffMemberResponse
    renderWithProviders(<EditStaffDrawer staff={owner} onClose={() => {}} />)

    const type = screen.getByLabelText(/^staff type/i)
    expect(type).toHaveValue('OfficeManager')
    await userEvent.selectOptions(type, 'Dentist')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(staffService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ staffType: 'Dentist' }))
  })

  // A dentist with visits ahead can't become desk staff: say so in the app's language
  it('explains why the type could not be changed', async () => {
    vi.mocked(staffService.update).mockRejectedValue(Object.assign(new Error('409'), {
      isAxiosError: true,
      response: { status: 409, data: { errors: [
        { name: 'Staff.HasUpcomingAppointments', reason: 'English text from the API' },
        { name: 'Staff.HasUpcomingAppointments.count', reason: '2' },
      ] } },
    }))
    renderWithProviders(<EditStaffDrawer staff={staff()} onClose={() => {}} />)

    await userEvent.selectOptions(screen.getByLabelText(/^staff type/i), 'Receptionist')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Amra Hadžić has 2 upcoming appointments. Cancel or move them first.'))
  })
})
