import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { useConfirm } from '@/shared/components/ConfirmDialog'
import { TempPasswordBox } from '@/shared/components/TempPasswordBox'
import { can, TENANT_ROLES, type TenantRole } from '@/shared/lib/permissions'
import { formatDate } from '@/shared/lib/format'
import { staffService, type StaffMemberResponse } from '../services/staffService'
import { peopleErrorMessage } from '../lib/peopleErrors'

const selectClass =
  'border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-gray-100 disabled:opacity-50'
const buttonClass =
  'px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50'

function Badge({ tone, children }: { tone: 'green' | 'gray' | 'amber'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>
}

/**
 * People-merge plan 4.3: whether this person can sign in, and — for the owner — giving,
 * changing, resetting and turning off that access. The API guards (self, last owner)
 * have the final say; their refusals arrive as toasts.
 */
export function StaffAccessSection({ staff }: { staff: StaffMemberResponse }) {
  const { t } = useTranslation('staff')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const headingId = useId()
  const roleId = useId()
  const canManage = can(useAuthStore(selectRoles), 'people.manage')
  const currentUserId = useAuthStore((s) => s.user?.userId)
  const confirm = useConfirm()
  const [newRole, setNewRole] = useState<TenantRole>('Staff')
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const access = staff.access ?? null
  const isSelf = !!access && access.userId === currentUserId
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] })
  const onError = (err: unknown) => toast.error(peopleErrorMessage(err, t, staff.fullName))

  const grant = useMutation({
    mutationFn: () => staffService.grantAccess(staff.id, newRole),
    onSuccess: (r) => { setTempPassword(r.tempPassword); refresh() },
    onError,
  })
  const changeRole = useMutation({
    mutationFn: (role: TenantRole) => staffService.changeRole(access!.userId, role),
    onSuccess: () => toast.success(t('access.roleChanged')),
    onError,
    onSettled: refresh,
  })
  const setActive = useMutation({
    mutationFn: (isActive: boolean) => staffService.setAccessActive(access!.userId, isActive),
    onError,
    onSettled: refresh,
  })
  const reset = useMutation({
    mutationFn: () => staffService.resetPassword(access!.userId),
    onSuccess: (r) => { setTempPassword(r.tempPassword); refresh() },
    onError,
  })

  return (
    <section aria-labelledby={headingId} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h2 id={headingId} className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t('access.title')}
      </h2>

      {!access && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('access.noAccess')}</p>
          {canManage && staff.isActive && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor={roleId} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('access.role')}</label>
                <select id={roleId} className={selectClass} value={newRole} onChange={(e) => setNewRole(e.target.value as TenantRole)}>
                  {TENANT_ROLES.map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
                </select>
              </div>
              <button type="button" className={buttonClass} disabled={grant.isPending || !staff.email}
                onClick={() => grant.mutate()}>
                {t('access.give')}
              </button>
              {!staff.email && <p className="w-full text-xs text-amber-600">{t('create.emailRequiredForAccess')}</p>}
            </div>
          )}
        </div>
      )}

      {access && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {access.isActive
              ? <Badge tone="green">{t('access.canSignIn')}</Badge>
              : <Badge tone="gray">{t('access.disabled')}</Badge>}
            {access.mustChangePassword && <Badge tone="amber">{t('access.mustChange')}</Badge>}
          </div>

          {/* DT-34: role and last sign-in are for the owner (the API leaves them out for others) */}
          {canManage && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('access.lastSignIn')}: {access.lastLoginAt ? formatDate(access.lastLoginAt) : t('access.never')}
            </p>
          )}

          {canManage && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor={roleId} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('access.role')}</label>
                {/* DT-06: confirmed first; the select shows the saved role until the API agrees */}
                <select id={roleId} className={selectClass} value={access.role ?? ''} disabled={isSelf || changeRole.isPending}
                  onChange={(e) => {
                    const role = e.target.value as TenantRole
                    confirm.ask({
                      title: t('access.roleTitle'),
                      description: role === 'ClinicOwner'
                        ? t('access.roleOwnerBody', { name: staff.fullName })
                        : t('access.roleBody', { name: staff.fullName, role: tc(`role.${role}`) }),
                      confirmLabel: t('access.roleConfirm'),
                      cancelLabel: tc('button.cancel'),
                      onConfirm: () => changeRole.mutate(role),
                    })
                  }}>
                  {TENANT_ROLES.map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
                </select>
              </div>
              <button type="button" className={buttonClass} disabled={reset.isPending}
                onClick={() => confirm.ask({
                  title: t('access.resetTitle'),
                  description: t('access.resetBody', { name: staff.fullName }),
                  confirmLabel: t('access.resetPassword'),
                  cancelLabel: tc('button.cancel'),
                  onConfirm: () => reset.mutate(),
                })}>
                {t('access.resetPassword')}
              </button>
              {access.isActive ? (
                <button type="button" className={buttonClass} disabled={isSelf || setActive.isPending}
                  onClick={() => confirm.ask({
                    title: t('access.turnOffTitle'),
                    description: t('access.turnOffBody', { name: staff.fullName }),
                    confirmLabel: t('access.turnOffConfirm'),
                    cancelLabel: tc('button.cancel'),
                    onConfirm: () => setActive.mutate(false),
                  })}>
                  {t('access.turnOff')}
                </button>
              ) : (
                <button type="button" className={buttonClass} disabled={isSelf || setActive.isPending}
                  onClick={() => setActive.mutate(true)}>
                  {t('access.turnOn')}
                </button>
              )}
              {isSelf && <p className="w-full text-xs text-gray-500 dark:text-gray-400">{t('access.selfHint')}</p>}
            </div>
          )}
        </div>
      )}

      {tempPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 dark:bg-amber-400/10 dark:border-amber-400/30">
          <p className="text-xs text-amber-700 font-medium">{t('access.tempPassword')}</p>
          <TempPasswordBox password={tempPassword} />
          <p className="text-xs text-amber-600">{t('create.tempPasswordWarning')}</p>
        </div>
      )}

      {confirm.dialog}
    </section>
  )
}
