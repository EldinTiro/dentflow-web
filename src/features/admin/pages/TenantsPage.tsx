import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantService, type TenantResponse } from '../services/tenantService'
import { CreateTenantModal } from '../components/CreateTenantModal'
import { Link } from 'react-router'

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0)
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">Expired</span>
  if (days <= 30)
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Exp. {days}d</span>
  return null
}

export function TenantsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', search, page],
    queryFn: () => tenantService.list({ searchTerm: search || undefined, page, pageSize: 20 }),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => tenantService.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const activate = useMutation({
    mutationFn: (id: string) => tenantService.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          New Tenant
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search tenants…"
          className="w-72 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No tenants found.
                </td>
              </tr>
            )}
            {data?.items.map((t: TenantResponse) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link to={`/admin/tenants/${t.id}`} className="hover:text-indigo-600">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3 text-gray-600">
                  <div className="flex items-center gap-2">
                    {t.plan}
                    <ExpiryBadge expiresAt={t.planExpiresAt} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge active={t.isActive} />
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.isActive ? (
                    <button
                      onClick={() => deactivate.mutate(t.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => activate.mutate(t.id)}
                      className="text-xs text-green-600 hover:text-green-700"
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Page {data.page} of {data.totalPages} ({data.totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={!data.hasPreviousPage}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
