import type { TFunction } from 'i18next'
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError'

/**
 * The refusals the people endpoints answer with (self, last owner, upcoming appointments…),
 * as one translated sentence for a toast. Anything else falls back to the API's message.
 */
export function peopleErrorMessage(err: unknown, t: TFunction<'staff'>, name: string): string {
  const codes = getApiErrorCodes(err)
  if (codes.has('User.Self')) return t('access.errors.self')
  if (codes.has('User.LastClinicOwner')) return t('access.errors.lastOwner')
  if (codes.has('User.OwnerOnly')) return t('access.errors.ownerOnly')
  if (codes.has('Staff.HasUpcomingAppointments')) {
    const count = Number(codes.get('Staff.HasUpcomingAppointments.count') ?? 0)
    return t('status.upcoming', { name, count })
  }
  if (codes.has('Staff.HasHistory')) return t('status.hasHistory', { name })
  if (['Auth.EmailAlreadyExists', 'Staff.AlreadyExists'].some((c) => codes.has(c))) return t('create.emailTaken')
  return getApiErrorMessage(err, t('access.failed'))
}
