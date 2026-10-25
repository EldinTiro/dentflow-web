import type { TenantRole } from '@/shared/lib/permissions'
import type { StaffType } from '../services/staffService'

/** A sensible first role for someone given sign-in access (DT-21); the owner can change it. */
const DEFAULT_ROLE: Record<StaffType, TenantRole> = {
  Dentist: 'Dentist',
  DentalAssistant: 'DentalNurse',
  Hygienist: 'DentalNurse',
  Receptionist: 'Receptionist',
  ClinicAdmin: 'Receptionist',
  OfficeManager: 'Receptionist',
}

export function defaultRoleFor(staffType: StaffType): TenantRole {
  return DEFAULT_ROLE[staffType] ?? 'Receptionist'
}
