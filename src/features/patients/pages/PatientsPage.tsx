import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { patientService, type PatientResponse, type PatientStatus } from '../services/patientService'
import { CreatePatientDrawer } from '../components/CreatePatientDrawer'

const STATUS_OPTIONS: { value: PatientStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Archived', label: 'Archived' },
  { value: 'Deceased', label: 'Deceased' },
]

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Archived: 'bg-amber-100 text-amber-700',
  Deceased: 'bg-red-100 text-red-600',
}

function StatusBadge({ status }: { status: PatientStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

export function PatientsPage() {
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
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          {data && (
            <p className="text-xs text-gray-400 mt-0.5">{data.totalCount} total</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + New Patient
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name, email, phone…"
          className="w-72 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as PatientStatus | ''); setPage(1) }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Patient #</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Date of Birth</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No patients found.</td>
              </tr>
            )}
            {data?.items.map((p: PatientResponse) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.patientNumber}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link to={`/patients/${p.id}`} className="hover:text-blue-600">
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {p.dateOfBirth
                    ? new Date(p.dateOfBirth + 'T00:00:00').toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.phoneMobile ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Page {data.page} of {data.totalPages} ({data.totalCount} total)</span>
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

      {showCreate && <CreatePatientDrawer onClose={() => setShowCreate(false)} />}
    </div>
  )
}
