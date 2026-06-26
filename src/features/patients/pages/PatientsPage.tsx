import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { patientService, type PatientResponse, type PatientStatus } from '../services/patientService'
import { CreatePatientDrawer } from '../components/CreatePatientDrawer'
import { EditPatientDrawer } from '../components/EditPatientDrawer'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useAuthStore } from '@/features/auth/store/authStore'

const STATUS_KEYS: { value: PatientStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'status.allStatuses' },
  { value: 'Active', labelKey: 'status.active' },
  { value: 'Inactive', labelKey: 'status.inactive' },
  { value: 'Transferred', labelKey: 'status.transferred' },
]

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Transferred: 'bg-blue-100 text-blue-700',
}

function StatusBadge({ status }: { status: PatientStatus }) {
  const { t } = useTranslation()
  const STATUS_LABEL_KEYS: Record<PatientStatus, string> = {
    Active: 'status.active', Inactive: 'status.inactive',
    Transferred: 'status.transferred',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  )
}

export function PatientsPage() {
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<PatientResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const roles = useAuthStore((s) => s.user?.roles ?? [])
  const canManage = roles.some((r) =>
    ['ClinicOwner', 'ClinicAdmin', 'Receptionist', 'SuperAdmin'].includes(r)
  )

  const search = searchParams.get('search') ?? ''
  const status = (searchParams.get('status') ?? '') as PatientStatus | ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const setSearch = (v: string) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); v ? n.set('search', v) : n.delete('search'); n.set('page', '1'); return n }, { replace: true })
  const setStatus = (v: PatientStatus | '') =>
    setSearchParams((p) => { const n = new URLSearchParams(p); v ? n.set('status', v) : n.delete('status'); n.set('page', '1'); return n }, { replace: true })
  const setPage = (v: number) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('page', String(v)); return n }, { replace: true })

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, status, page],
    queryFn: () =>
      patientService.list({
        search: search || undefined,
        status: (status as PatientStatus) || undefined,
        page,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success(t('toast.deleted'))
      setDeletingId(null)
    },
    onError: () => {
      toast.error(t('toast.deleteFailed'))
    },
  })

  const deletingPatient = deletingId ? data?.items.find((p) => p.id === deletingId) : null
  const colCount = canManage ? 7 : 6

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          {data && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('totalCount', { count: data.totalCount })}</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          {t('button.newPatient')}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-72 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PatientStatus | '')}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{tc(o.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('table.patientNumber')}</th>
              <th className="px-4 py-3 text-left">{t('table.name')}</th>
              <th className="px-4 py-3 text-left">{t('table.dateOfBirth')}</th>
              <th className="px-4 py-3 text-left">{t('table.mobile')}</th>
              <th className="px-4 py-3 text-left">{t('table.email')}</th>
              <th className="px-4 py-3 text-left">{t('table.status')}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-400">{tc('loading')}</td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-400">{t('emptyState')}</td>
              </tr>
            )}
            {data?.items.map((p: PatientResponse) => (
              <tr
                key={p.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => navigate(`/patients/${p.id}`)}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">{p.patientNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.fullName}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {p.dateOfBirth
                    ? new Date(p.dateOfBirth + 'T00:00:00').toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.phoneMobile ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(p) }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title={tc('button.edit')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(p.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={t('table.deleteTooltip')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span>{tc('pagination.pageOfTotal', { page: data.page, totalPages: data.totalPages, totalCount: data.totalCount })}</span>
            <div className="flex gap-2">
              <button
                disabled={!data.hasPreviousPage}
                onClick={() => setPage(page - 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.prev')}
              </button>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage(page + 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreatePatientDrawer onClose={() => setShowCreate(false)} />}
      {editing && <EditPatientDrawer patient={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!deletingId}
        title={t('confirm.deleteTitle')}
        description={t('confirm.deleteDescription', { name: deletingPatient?.fullName ?? '' })}
        confirmLabel={tc('button.delete')}
        cancelLabel={tc('button.cancel')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
