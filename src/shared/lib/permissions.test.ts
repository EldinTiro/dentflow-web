import { describe, it, expect } from 'vitest'
import { canViewFinance } from './permissions'

describe('canViewFinance', () => {
  // Mirrors RolePermissions in the API: clinic-level money is for the people who run the business
  it.each(['ClinicOwner', 'ClinicAdmin', 'BillingStaff', 'ReadOnly'])('is true for %s', (role) => {
    expect(canViewFinance([role])).toBe(true)
  })

  it.each(['Dentist', 'Hygienist', 'Receptionist', 'SuperAdmin'])('is false for %s', (role) => {
    expect(canViewFinance([role])).toBe(false)
  })

  it('is true when any of several roles grants it', () => {
    expect(canViewFinance(['Dentist', 'ClinicOwner'])).toBe(true)
  })
})
