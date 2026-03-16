import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  staffService,
  STAFF_TYPE_LABELS,
  ALL_STAFF_TYPES,
  type StaffType,
  type StaffMemberResponse,
} from '../services/staffService';
import { CreateStaffDrawer } from '../components/CreateStaffDrawer';
import { EditStaffDrawer } from '../components/EditStaffDrawer';
import { useAuthStore } from '@/features/auth/store/authStore';

export function StaffPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage =
    roles.includes('ClinicOwner') || roles.includes('ClinicAdmin') || roles.includes('SuperAdmin');

  const [search, setSearch] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState<StaffType | ''>('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StaffMemberResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', search, staffTypeFilter, page],
    queryFn: () =>
      staffService.list({
        searchTerm: search || undefined,
        staffType: staffTypeFilter || undefined,
        page,
        pageSize: 20,
      }),
  });

  const members = data?.items ?? [];
  const total = data?.totalCount ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} member{total !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Add Staff
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={staffTypeFilter}
          onChange={(e) => { setStaffTypeFilter(e.target.value as StaffType | ''); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All types</option>
          {ALL_STAFF_TYPES.map((t) => (
            <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Specialty</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Color</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-10 text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-10 text-gray-400">
                  No staff members found.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{STAFF_TYPE_LABELS[m.staffType]}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.specialty ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: m.colorHex ?? '#3B82F6' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(m)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && <CreateStaffDrawer onClose={() => setShowCreate(false)} />}
      {editing && (
        <EditStaffDrawer staff={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
