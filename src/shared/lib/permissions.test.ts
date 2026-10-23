import { describe, it, expect } from 'vitest'
import { can, canViewFinance, TENANT_ROLES } from './permissions'

describe('TENANT_ROLES', () => {
  // Mirrors Roles.TenantRoles in the API: the four roles a clinic account can hold
  it('is the four clinic roles, owner first', () => {
    expect(TENANT_ROLES).toEqual(['ClinicOwner', 'Dentist', 'DentalNurse', 'Receptionist'])
  })
})

describe('can', () => {
  // Mirrors RolePermissions in the API, which is what actually enforces it
  it.each(TENANT_ROLES)('lets %s manage patients', (role) => {
    expect(can([role], 'patients.manage')).toBe(true)
  })

  it('does not let the platform admin manage clinic patients', () => {
    expect(can(['SuperAdmin'], 'patients.manage')).toBe(false)
  })

  it('keeps people.manage with the owner', () => {
    expect(can(['ClinicOwner'], 'people.manage')).toBe(true)
    for (const role of ['Dentist', 'DentalNurse', 'Receptionist', 'SuperAdmin']) {
      expect(can([role], 'people.manage')).toBe(false)
    }
  })

  it('lets the desk collect payments but not a dentist', () => {
    expect(can(['Receptionist'], 'billing.collect')).toBe(true)
    expect(can(['DentalNurse'], 'billing.collect')).toBe(true)
    expect(can(['Dentist'], 'billing.collect')).toBe(false)
  })

  it('is false for retired and unknown roles', () => {
    expect(can(['ClinicAdmin'], 'people.manage')).toBe(false)
    expect(can(['ReadOnly'], 'finance.view')).toBe(false)
  })

  it('is true when any of several roles grants it', () => {
    expect(can(['Dentist', 'ClinicOwner'], 'people.manage')).toBe(true)
  })
})

describe('canViewFinance', () => {
  it('is the owner only', () => {
    expect(canViewFinance(['ClinicOwner'])).toBe(true)
    for (const role of ['Dentist', 'DentalNurse', 'Receptionist', 'SuperAdmin']) {
      expect(canViewFinance([role])).toBe(false)
    }
  })
})
