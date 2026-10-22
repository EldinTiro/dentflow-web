import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { tenantService, type TenantResponse } from '../services/tenantService'
import { CreateTenantModal } from '../components/CreateTenantModal'
import { Link } from 'react-router'
import { useConfirm } from '@/shared/components/ConfirmDialog'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/lib/format'

function Badge({ active, t }: { active: boolean; t: (key: string) => string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
      }`}
    >
      {active ? t('status.active') : t('status.inactive')}
    </span>
  )
}

function ExpiryBadge({ expiresAt, t, ta }: { expiresAt: string | null; t: (key: string) => string; ta: (key: string, opts?: Record<string, unknown>) => string }) {
  if (!expiresAt) return null
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0)
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300">{t('expiry.expired')}</span>
  if (days <= 30)
    return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">{ta('tenants.expiryDays', { days })}</span>
  return null
}

export function TenantsPage() {
  const { t: ta } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
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
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })
  const confirm = useConfirm()

  const activate = useMutation({
    mutationFn: (id: string) => tenantService.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{ta('tenants.title')}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
        >
          {ta('tenants.button.newTenant')}
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={ta('tenants.search.placeholder')}
          aria-label={ta('tenants.search.placeholder')}
          className="w-72 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto dark:bg-gray-900 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">{ta('tenants.table.name')}</th>
              <th className="px-4 py-3 text-left">{ta('tenants.table.slug')}</th>
              <th className="px-4 py-3 text-left">{ta('tenants.table.plan')}</th>
              <th className="px-4 py-3 text-left">{ta('tenants.table.status')}</th>
              <th className="px-4 py-3 text-left">{ta('tenants.table.created')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  {ta('tenants.emptyState')}
                </td>
              </tr>
            )}
            {data?.items.map((tn: TenantResponse) => (
              <tr key={tn.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <Link to={`/admin/tenants/${tn.id}`} className="hover:text-primary-600">
                    {tn.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs dark:text-gray-400">{tn.slug}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    {tn.plan}
                    <ExpiryBadge expiresAt={tn.planExpiresAt} t={tc} ta={ta} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge active={tn.isActive} t={tc} />
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatDate(tn.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {tn.isActive ? (
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: tc('confirmAction.deactivateTenantTitle', { name: tn.name }),
                          description: tc('confirmAction.deactivateTenantBody'),
                          confirmLabel: tc('button.deactivate'),
                          cancelLabel: tc('button.cancel'),
                          onConfirm: () => deactivate.mutate(tn.id),
                        })
                      }
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      {tc('button.deactivate')}
                    </button>
                  ) : (
                    <button
                      onClick={() => activate.mutate(tn.id)}
                      className="text-xs text-green-700 hover:text-green-700"
                    >
                      {tc('button.activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500 dark:text-gray-400 dark:border-gray-800">
            <span>
              {tc('pagination.pageOfTotal', { page: data.page, totalPages: data.totalPages, totalCount: data.totalCount })}
            </span>
            <div className="flex gap-2">
              <button
                disabled={!data.hasPreviousPage}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700"
              >
                {tc('button.previous')}
              </button>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700"
              >
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
      {confirm.dialog}
    </div>
  )
}
