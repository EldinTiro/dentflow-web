import { describe, it, expect } from 'vitest'
import { can, canViewFinance, TENANT_ROLES } from './permissions'

// Two clinic roles (2026-11-02): the role says what someone may do, the staff type says
// what they are. Mirrors Roles / RolePermissions in the API, which is what enforces it.
describe('TENANT_ROLES', () => {
  it('is the Administrator and Staff, Administrator first', () => {
    expect(TENANT_ROLES).toEqual(['ClinicOwner', 'Staff'])
  })
})

describe('can', () => {
  it.each(TENANT_ROLES)('lets %s manage patients and treatment plans', (role) => {
    expect(can([role], 'patients.manage')).toBe(true)
    expect(can([role], 'treatments.manage')).toBe(true)
  })

  it("lets Staff see and collect a patient's bill", () => {
    expect(can(['Staff'], 'billing.view')).toBe(true)
    expect(can(['Staff'], 'billing.collect')).toBe(true)
  })

  it('keeps clinic money and people with the Administrator', () => {
    for (const permission of ['finance.view', 'finance.adjust', 'people.manage'] as const) {
      expect(can(['ClinicOwner'], permission)).toBe(true)
      expect(can(['Staff'], permission)).toBe(false)
    }
  })

  it('does not let the platform admin manage clinic patients', () => {
    expect(can(['SuperAdmin'], 'patients.manage')).toBe(false)
  })

  it('is false for retired and unknown roles', () => {
    for (const role of ['Dentist', 'DentalNurse', 'Receptionist', 'ClinicAdmin', 'ReadOnly']) {
      expect(can([role], 'patients.manage')).toBe(false)
    }
  })

  it('is true when any of several roles grants it', () => {
    expect(can(['Staff', 'ClinicOwner'], 'people.manage')).toBe(true)
  })
})

describe('canViewFinance', () => {
  it('is the Administrator only', () => {
    expect(canViewFinance(['ClinicOwner'])).toBe(true)
    expect(canViewFinance(['Staff'])).toBe(false)
    expect(canViewFinance(['SuperAdmin'])).toBe(false)
  })
})
