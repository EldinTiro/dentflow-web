import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { StaffMemberResponse } from '../services/staffService'
import { EditStaffDrawer } from './EditStaffDrawer'

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
    renderWithProviders(<EditStaffDrawer staff={staff({ userId: 'u1', role: 'Dentist', isActive: true, mustChangePassword: false, lastLoginAt: null })} onClose={() => {}} />)

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
})
