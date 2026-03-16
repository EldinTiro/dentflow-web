import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { userService, type TenantUserResponse } from '../services/userService'
import { InviteUserDrawer } from '../components/InviteUserDrawer'

const TENANT_ROLES = [
  'ClinicOwner', 'ClinicAdmin', 'Dentist', 'Hygienist',
  'Receptionist', 'BillingStaff', 'ReadOnly',
]

export function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showInvite, setShowInvite] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)

  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin'].includes(r)) ?? false
  )

  const { data, isLoading } = useQuery({
    queryKey: ['team-users', search, page],
    queryFn: () => userService.list({ search: search || undefined, page, pageSize: 20 }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.updateStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-users'] }),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      userService.changeRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-users'] }),
  })

  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          {data && <p className="text-xs text-gray-400 mt-0.5">{data.totalCount} members</p>}
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + Invite Member
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name or email…"
          className="w-72 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-gray-400">
                  No team members found.
                </td>
              </tr>
            )}
            {data?.items.map((u: TenantUserResponse) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <select
                      defaultValue={u.role ?? ''}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                      className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {TENANT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="text-gray-600 text-xs">{u.role ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => updateStatus.mutate({ id: u.id, isActive: !u.isActive })}
                      className={`text-xs ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Page {page} of {totalPages} ({data?.totalCount} total)</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showInvite && <InviteUserDrawer onClose={() => setShowInvite(false)} />}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Temporary Password</h3>
            <p className="font-mono text-sm bg-amber-50 px-3 py-2 rounded border border-amber-200 break-all mb-4">
              {resetResult}
            </p>
            <button
              onClick={() => setResetResult(null)}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
