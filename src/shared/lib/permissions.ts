/**
 * Roles holding `finance.view` — clinic-level money: revenue, outstanding totals and the
 * full invoice ledger. Mirrors `RolePermissions` in dentflow-api (Domain/Identity), which
 * is what actually enforces it; this only decides what to show.
 * TODO(roles step 4): read permissions from the API at sign-in instead of mirroring the map.
 */
export const FINANCE_ROLES = ['ClinicOwner', 'ClinicAdmin', 'BillingStaff', 'ReadOnly'] as const

export function canViewFinance(roles: readonly string[]): boolean {
  return roles.some((r) => (FINANCE_ROLES as readonly string[]).includes(r))
}
