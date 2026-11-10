import { useState } from 'react'
import { NoCardBadge } from '../components/OpenCardDialog'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Pencil, Search, X } from 'lucide-react'
import { patientService, type PatientResponse, type PatientStatus } from '../services/patientService'
import { CreatePatientDrawer } from '../components/CreatePatientDrawer'
import { EditPatientDrawer } from '../components/EditPatientDrawer'
import { PatientPreviewPanel } from '../components/PatientPreviewPanel'
import { ageOn, avatarTint, initialsOf } from '../lib/patientDisplay'
import { formatDate, formatDayMonth } from '@/shared/lib/format'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { can } from '@/shared/lib/permissions'

// Active first and by default: inactive patients leave the daily list (people-merge D11).
type StatusFilter = PatientStatus | 'all'
const STATUS_KEYS: { value: StatusFilter; labelKey: string }[] = [
  { value: 'Active', labelKey: 'status.active' },
  { value: 'Inactive', labelKey: 'status.inactive' },
  { value: 'Transferred', labelKey: 'status.transferred' },
  { value: 'all', labelKey: 'status.allStatuses' },
]

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  Inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  Transferred: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
}
const STATUS_LABEL_KEYS: Record<PatientStatus, string> = { Active: 'status.active', Inactive: 'status.inactive', Transferred: 'status.transferred' }

export function PatientsPage() {
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
  const [searchParams, setSearchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<PatientResponse | null>(null)

  const roles = useAuthStore(selectRoles)
  const canManage = can(roles, 'patients.manage')

  const search = searchParams.get('search') ?? ''
  const status = (searchParams.get('status') ?? 'Active') as StatusFilter
  const recallFilter = (searchParams.get('recallFilter') ?? '') as 'overdue' | 'due-soon' | ''
  const selectedId = searchParams.get('p')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const update = (key: string, value: string | null, resetPage = true) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); value ? n.set(key, value) : n.delete(key); if (resetPage) n.set('page', '1'); return n }, { replace: true })
  const setSearch = (v: string) => update('search', v || null)
  const setStatus = (v: StatusFilter) => update('status', v !== 'Active' ? v : null)
  const select = (id: string | null) => update('p', id, false)
  const clearRecallFilter = () => update('recallFilter', null)
  const setPage = (v: number) => update('page', String(v), false)

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, status, recallFilter, page],
    queryFn: () =>
      patientService.list({
        search: search || undefined,
        status,
        recallFilter: recallFilter || undefined,
        page,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  })
  const selected = data?.items.find((p) => p.id === selectedId) ?? null
  const colCount = canManage ? 5 : 4
  return (
    <div className="p-6 max-w-[1600px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          {data && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {t('totalCount', { count: data.totalCount })}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          {t('button.newPatient')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full border border-control dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          aria-label={t('filter.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="border border-control dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{tc(o.labelKey)}</option>
          ))}
        </select>
      </div>

      {recallFilter && (
        <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg text-sm font-medium border ${
          recallFilter === 'overdue'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
        }`}>
          <span>
            {recallFilter === 'overdue' ? t('recallBanner.overdue') : t('recallBanner.dueSoon')}
            {data && ` — ${t('recallBanner.patients', { count: data.totalCount })}`}
          </span>
          <button onClick={clearRecallFilter} className="ml-auto p-0.5 rounded hover:bg-black/10 transition-colors" title={tc('button.close')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* B: the list, and beside it (from 1280px) a quick look at the patient picked */}
      <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''} xl:items-start`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t('table.patient')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('table.parentName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('table.lastVisit')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('table.dateOfBirth')}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">{tc('loading')}</td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">{t('emptyState')}</td>
              </tr>
            )}
            {data?.items.map((p: PatientResponse) => {
              const facts = p.insights
              const age = ageOn(p.dateOfBirth)
              return (
                <tr
                  key={p.id}
                  data-inactive={p.status === 'Inactive' ? 'true' : undefined}
                  aria-selected={p.id === selectedId}
                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${p.id === selectedId ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''} ${p.status === 'Inactive' ? 'opacity-60' : ''}`}
                  onClick={() => select(p.id === selectedId ? null : p.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(p.id)}`}>{initialsOf(p.fullName)}</div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                          <span className="truncate">{p.fullName}</span>
                          {facts && facts.allergyCount > 0 && (
                            <AlertTriangle size={14} className="shrink-0 text-red-600 dark:text-red-400" aria-label={t('allergyLabel', { severity: t(`allergySeverity.${facts.severestAllergy}`, { defaultValue: facts.severestAllergy ?? '' }) })} />
                          )}
                          {p.status !== 'Active' && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status]}`}>{tc(STATUS_LABEL_KEYS[p.status])}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                          {p.patientNumber
                            ? <span className="font-semibold text-gray-800 dark:text-gray-200">{p.patientNumber}</span>
                            : <NoCardBadge />}
                          {[age !== null ? t('age', { count: age }) : null, p.phoneMobile].filter(Boolean).map((part) => ` · ${part}`).join('')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.parentName || '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400">{facts?.lastVisitAt ? formatDayMonth(facts.lastVisitAt, { month: 'short', year: true }) : '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{formatDate(p.dateOfBirth)}</td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(p) }}
                        className="p-1.5 text-gray-500 hover:text-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors dark:text-gray-400"
                        title={tc('button.edit')}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <span>{tc('pagination.pageOfTotal', { page: data.page, totalPages: data.totalPages, totalCount: data.totalCount })}</span>
            <div className="flex gap-2">
              <button disabled={!data.hasPreviousPage} onClick={() => setPage(page - 1)}
                className="px-2 py-1 rounded border border-control dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                {tc('button.prev')}
              </button>
              <button disabled={!data.hasNextPage} onClick={() => setPage(page + 1)}
                className="px-2 py-1 rounded border border-control dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto p-3 xl:static xl:z-auto xl:max-h-none xl:overflow-visible xl:p-0 xl:sticky xl:top-4">
          <PatientPreviewPanel patient={selected} onClose={() => select(null)} />
        </div>
      )}
      </div>

      {showCreate && <CreatePatientDrawer onClose={() => setShowCreate(false)} />}
      {editing && <EditPatientDrawer patient={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
