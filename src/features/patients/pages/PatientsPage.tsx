import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { patientService, type PatientResponse, type PatientStatus } from '../services/patientService'
import { CreatePatientDrawer } from '../components/CreatePatientDrawer'

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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PatientStatus | ''>('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

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
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {t('button.newPatient')}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('search.placeholder')}
          className="w-72 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as PatientStatus | ''); setPage(1) }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{tc('loading')}</td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('emptyState')}</td>
              </tr>
            )}
            {data?.items.map((p: PatientResponse) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">{p.patientNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <Link to={`/patients/${p.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                    {p.fullName}
                  </Link>
                </td>
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
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.prev')}
              </button>
              <button
                disabled={!data.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
              >
                {tc('button.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreatePatientDrawer onClose={() => setShowCreate(false)} />}
    </div>
  )
}
