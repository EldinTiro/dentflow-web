import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userAdminService, type UserAdminResponse } from '../services/userAdminService'
import { tenantService } from '../services/tenantService'

const ROLES = [
  'SuperAdmin', 'ClinicOwner', 'ClinicAdmin', 'Dentist',
  'Hygienist', 'Receptionist', 'BillingStaff', 'ReadOnly',
]

function ResetPasswordResult({ tempPassword, onClose }: { tempPassword: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Password Reset</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm">
          <p className="text-amber-800 font-medium mb-1">New temporary password</p>
          <p className="font-mono text-gray-800 bg-white px-2 py-1 rounded border border-amber-200 text-xs break-all">
            {tempPassword}
          </p>
          <p className="text-amber-700 text-xs mt-2">Share this with the user. It will not be shown again.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [page, setPage] = useState(1)
  const [resetResult, setResetResult] = useState<string | null>(null)

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
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      userAdminService.changeRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const resetPwd = useMutation({
    mutationFn: (id: string) => userAdminService.resetPassword(id),
    onSuccess: (data) => setResetResult(data.tempPassword),
  })

  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search users…"
          className="w-64 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={tenantFilter}
          onChange={(e) => { setTenantFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All tenants</option>
          {tenantsData?.items.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
            {data?.items.map((u: UserAdminResponse) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={u.role ?? ''}
                    onChange={(e) =>
                      changeRole.mutate({ id: u.id, role: e.target.value })
                    }
                    className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      onClick={() => toggleStatus.mutate({ id: u.id, isActive: !u.isActive })}
                      className={u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => resetPwd.mutate(u.id)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Reset password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Page {page} of {totalPages} ({data?.totalCount} total)
            </span>
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

      {resetResult && (
        <ResetPasswordResult
          tempPassword={resetResult}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  )
}
