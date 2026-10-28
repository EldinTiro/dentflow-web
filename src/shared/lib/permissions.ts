/**
 * Roles and what each may do. Mirrors `Roles` and `RolePermissions` in dentflow-api
 * (Domain/Identity), which is what actually enforces it; this only decides what to show.
 * TODO(roles step 4): read permissions from the API at sign-in instead of mirroring the map.
 */

/** The four roles a clinic account can hold (`Roles.TenantRoles`), owner first. */
export const TENANT_ROLES = ['ClinicOwner', 'Dentist', 'DentalNurse', 'Receptionist'] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

export type Permission =
  | 'dashboard.view'
  | 'billing.view'
  | 'billing.collect'
  | 'finance.adjust'
  | 'finance.view'
  | 'people.manage'
  | 'patients.manage'
  /** Treatment plans and their items. The API checks it with a role list (DT-12). */
  | 'treatments.manage'

const ALL: readonly Permission[] = [
  'dashboard.view', 'billing.view', 'billing.collect', 'finance.adjust', 'finance.view', 'people.manage', 'patients.manage',
  'treatments.manage',
]

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  ClinicOwner: ALL,
  Dentist: ['dashboard.view', 'billing.view', 'patients.manage', 'treatments.manage'],
  DentalNurse: ['dashboard.view', 'billing.view', 'billing.collect', 'patients.manage', 'treatments.manage'],
  Receptionist: ['dashboard.view', 'billing.view', 'billing.collect', 'patients.manage'],
  SuperAdmin: ['dashboard.view'],
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(permission) ?? false)
}

/** Roles holding a permission — for route guards that take a role list. */
export function rolesWith(permission: Permission): string[] {
  return Object.keys(ROLE_PERMISSIONS).filter((r) => ROLE_PERMISSIONS[r].includes(permission))
}

/** Clinic-level money: revenue, outstanding totals and the full invoice ledger. */
export const FINANCE_ROLES = rolesWith('finance.view')

export function canViewFinance(roles: readonly string[]): boolean {
  return can(roles, 'finance.view')
}

/** Any clinic role (not the platform admin). */
export function isClinicMember(roles: readonly string[]): boolean {
  return roles.some((r) => (TENANT_ROLES as readonly string[]).includes(r))
}
