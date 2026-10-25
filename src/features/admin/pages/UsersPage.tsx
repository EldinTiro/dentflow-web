import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { userAdminService, type UserAdminResponse } from '../services/userAdminService'
import { tenantService } from '../services/tenantService'
import { useAuthStore } from '@/features/auth/store/authStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useConfirm } from '@/shared/components/ConfirmDialog'
import { TempPasswordBox } from '@/shared/components/TempPasswordBox'
import { TENANT_ROLES } from '@/shared/lib/permissions'

const ROLES = ['SuperAdmin', ...TENANT_ROLES]

function ResetPasswordResult({ tempPassword, onClose, t, tc }: { tempPassword: string; onClose: () => void; t: (key: string) => string; tc: (key: string) => string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('adminUsers.resetPwd.title')}</h3>
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md p-3 mb-4 text-sm">
          <p className="text-amber-800 dark:text-amber-300 font-medium mb-1">{t('adminUsers.resetPwd.label')}</p>
          <TempPasswordBox password={tempPassword} />
          <p className="text-amber-700 dark:text-amber-400 text-xs mt-2">{t('adminUsers.resetPwd.warning')}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          {tc('button.done')}
        </button>
      </div>
    </div>
  )
}

export function UsersPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [page, setPage] = useState(1)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const currentUserId = useAuthStore((s) => s.user?.userId)

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-for-filter'],
    queryFn: () => tenantService.list({ pageSize: 200 }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter, tenantFilter, page],
    queryFn: () =>
      userAdminService.list({
        searchTerm: search || undefined,
        role: roleFilter || undefined,
        tenantId: tenantFilter || undefined,
        page,
        pageSize: 20,
      }),
  })

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userAdminService.updateStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      userAdminService.changeRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    // The select keeps the rejected value otherwise; refetch puts the real role back.
    onError: (err) => {
      toast.error(getApiErrorMessage(err))
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const resetPwd = useMutation({
    mutationFn: (id: string) => userAdminService.resetPassword(id),
    onSuccess: (data) => setResetResult(data.tempPassword),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })
  const confirm = useConfirm()

  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('adminUsers.title')}</h1>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('adminUsers.search.placeholder')}
          className="w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('adminUsers.filter.allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{tc(`role.${r}`)}</option>
          ))}
        </select>
        <select
          value={tenantFilter}
          onChange={(e) => { setTenantFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('adminUsers.filter.allTenants')}</option>
          {tenantsData?.items.map((tn) => (
            <option key={tn.id} value={tn.id}>{tn.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('adminUsers.table.name')}</th>
              <th className="px-4 py-3 text-left">{t('adminUsers.table.email')}</th>
              <th className="px-4 py-3 text-left">{t('adminUsers.table.role')}</th>
              <th className="px-4 py-3 text-left">{t('adminUsers.table.status')}</th>
              <th className="px-4 py-3 text-left">{t('adminUsers.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  {t('adminUsers.emptyState')}
                </td>
              </tr>
            )}
            {data?.items.map((u: UserAdminResponse) => {
              // The API refuses both on your own account and SuperAdmin for clinic users (QA-012).
              const isSelf = u.id === currentUserId
              const roleOptions = u.tenantId ? ROLES.filter((r) => r !== 'SuperAdmin') : ROLES
              return (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    key={u.role ?? ''}
                    defaultValue={u.role ?? ''}
                    disabled={isSelf}
                    aria-label={`${t('adminUsers.table.role')}: ${u.fullName}`}
                    onChange={(e) => {
                      const select = e.target
                      const role = select.value
                      confirm.ask({
                        title: tc('confirmAction.changeRoleTitle', { name: u.fullName }),
                        description: tc('confirmAction.changeRoleBody', { from: u.role ? tc(`role.${u.role}`) : '—', to: tc(`role.${role}`) }),
                        confirmLabel: tc('confirmAction.changeRole'),
                        cancelLabel: tc('button.cancel'),
                        onConfirm: () => changeRole.mutate({ id: u.id, role }),
                      })
                      // Keep showing the current role until the change is confirmed and saved.
                      select.value = u.role ?? ''
                    }}
                    className="border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{tc(`role.${r}`)}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
                    }`}
                  >
                    {u.isActive ? tc('status.active') : tc('status.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs">
                    {!isSelf && (
                      <button
                        onClick={() =>
                          u.isActive
                            ? confirm.ask({
                                title: tc('confirmAction.deactivateUserTitle', { name: u.fullName }),
                                description: tc('confirmAction.deactivateUserBody'),
                                confirmLabel: tc('button.deactivate'),
                                cancelLabel: tc('button.cancel'),
                                onConfirm: () => toggleStatus.mutate({ id: u.id, isActive: false }),
                              })
                            : toggleStatus.mutate({ id: u.id, isActive: true })
                        }
                        className={u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-700 hover:text-green-700'}
                      >
                        {u.isActive ? tc('button.deactivate') : tc('button.activate')}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: tc('confirmAction.resetPasswordTitle', { name: u.fullName }),
                          description: tc('confirmAction.resetPasswordBody'),
                          confirmLabel: tc('confirmAction.resetPassword'),
                          cancelLabel: tc('button.cancel'),
                          onConfirm: () => resetPwd.mutate(u.id),
                        })
                      }
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {t('adminUsers.resetPassword')}
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {tc('pagination.pageOfTotal', { page, totalPages, totalCount: data?.totalCount })}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.prev')}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {resetResult && (
        <ResetPasswordResult
          tempPassword={resetResult}
          onClose={() => setResetResult(null)}
          t={t}
          tc={tc}
        />
      )}
      {confirm.dialog}
    </div>
  )
}
