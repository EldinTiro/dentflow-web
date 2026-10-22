import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { userService, type TenantUserResponse } from '../services/userService'
import { InviteUserDrawer } from '../components/InviteUserDrawer'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/lib/format'

const TENANT_ROLES = [
  'ClinicOwner', 'ClinicAdmin', 'Dentist', 'Hygienist',
  'Receptionist', 'BillingStaff', 'ReadOnly',
]

export function UsersPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showInvite, setShowInvite] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)

  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin'].includes(r)) ?? false
  )
  const currentUserId = useAuthStore((s) => s.user?.userId)
  const isOwner = useAuthStore((s) => s.user?.roles?.includes('ClinicOwner') ?? false)
  // Mirrors the API (QA-012): nobody edits their own account, only owners touch owners.
  const canEdit = (u: TenantUserResponse) =>
    canManage && u.id !== currentUserId && (isOwner || u.role !== 'ClinicOwner')
  const assignableRoles = isOwner ? TENANT_ROLES : TENANT_ROLES.filter((r) => r !== 'ClinicOwner')

  const { data, isLoading } = useQuery({
    queryKey: ['team-users', search, page],
    queryFn: () => userService.list({ search: search || undefined, page, pageSize: 20 }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.updateStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-users'] }),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      userService.changeRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-users'] }),
    onError: (err) => {
      toast.error(getApiErrorMessage(err))
      queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
  })

  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('team.title')}</h1>
          {data && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('team.memberCount', { count: data.totalCount })}</p>}
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            {t('team.button.invite')}
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('team.search.placeholder')}
          className="w-72 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('team.table.name')}</th>
              <th className="px-4 py-3 text-left">{t('team.table.email')}</th>
              <th className="px-4 py-3 text-left">{t('team.table.role')}</th>
              <th className="px-4 py-3 text-left">{t('team.table.status')}</th>
              <th className="px-4 py-3 text-left">{t('team.table.lastLogin')}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  {t('team.emptyState')}
                </td>
              </tr>
            )}
            {data?.items.map((u: TenantUserResponse) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <select
                      key={u.role ?? ''}
                      defaultValue={u.role ?? ''}
                      disabled={!canEdit(u)}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                      className="border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {(canEdit(u) ? assignableRoles : TENANT_ROLES).map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
                    </select>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400 text-xs">{u.role ? tc(`role.${u.role}`) : '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
                  }`}>
                    {u.isActive ? tc('status.active') : tc('status.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {u.lastLoginAt
                    ? formatDate(u.lastLoginAt)
                    : tc('lastLogin.never')}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {canEdit(u) && (
                      <button
                        onClick={() => updateStatus.mutate({ id: u.id, isActive: !u.isActive })}
                        className={`text-xs ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-700 hover:text-green-700'}`}
                      >
                        {u.isActive ? tc('button.deactivate') : tc('button.activate')}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span>{tc('pagination.pageOfTotal', { page, totalPages, totalCount: data?.totalCount })}</span>
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

      {showInvite && <InviteUserDrawer onClose={() => setShowInvite(false)} />}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('team.resetPwd.title')}</h3>
            <p className="font-mono text-sm bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded border border-amber-200 dark:border-amber-700 text-gray-800 dark:text-gray-200 break-all mb-4">
              {resetResult}
            </p>
            <button
              onClick={() => setResetResult(null)}
              className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              {tc('button.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
