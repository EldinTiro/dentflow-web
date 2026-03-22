import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('staff')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate();
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
    placeholderData: (prev) => prev,
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('memberCount', { count: total })}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('button.addStaff')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t('search.placeholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={staffTypeFilter}
          onChange={(e) => { setStaffTypeFilter(e.target.value as StaffType | ''); setPage(1); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{tc('staffType.allTypes')}</option>
          {ALL_STAFF_TYPES.map((t) => (
            <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.name')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.type')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.email')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.phone')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.specialty')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.color')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.status')}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-10 text-gray-400">
                  {tc('loading')}
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-10 text-gray-400">
                  {t('emptyState')}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => navigate(`/staff/${m.id}`)}>
                  <td className="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{STAFF_TYPE_LABELS[m.staffType]}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.specialty ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: m.colorHex ?? '#3B82F6' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`dot-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.isActive ? tc('status.active') : tc('status.inactive')}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
                      >
                        {tc('button.edit')}
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
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            {tc('pagination.showingRange', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {tc('button.prev')}
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {tc('button.next')}
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
