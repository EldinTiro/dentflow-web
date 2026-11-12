import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  staffService,
  ALL_STAFF_TYPES,
  SELECTABLE_STAFF_TYPES,
  type StaffType,
  type StaffMemberResponse,
} from '../services/staffService';
import { CreateStaffDrawer } from '../components/CreateStaffDrawer';
import { EditStaffDrawer } from '../components/EditStaffDrawer';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore';
import { can } from '@/shared/lib/permissions'
import { peopleErrorMessage } from '../lib/peopleErrors'
import { FilterChips } from '@/shared/components/FilterChips'
import { SearchInput } from '@/shared/components/SearchInput'

type AccessFilter = '' | 'with' | 'without'
type StatusFilter = 'active' | 'inactive' | 'all'

/** People-merge plan 4.4: one word for where a person's sign-in stands. */
function accessState(m: StaffMemberResponse): 'none' | 'canSignIn' | 'waiting' | 'disabled' {
  if (!m.access) return 'none'
  if (!m.access.isActive) return 'disabled'
  return m.access.mustChangePassword ? 'waiting' : 'canSignIn'
}

const ACCESS_TONE = {
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  canSignIn: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  disabled: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
} as const

export function StaffPage() {
  const { t } = useTranslation('staff')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate();
  const roles = useAuthStore(selectRoles);
  const canManage = can(roles, 'people.manage');

  const [search, setSearch] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState<StaffType | ''>('');
  // Active by default (D11), like the API; the access filter works on the loaded page.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StaffMemberResponse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', search, staffTypeFilter, statusFilter, page],
    queryFn: () =>
      staffService.list({
        searchTerm: search || undefined,
        staffType: staffTypeFilter || undefined,
        isActive: statusFilter === 'all' ? 'all' : statusFilter === 'active',
        page,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('toast.deleted'))
      setDeletingId(null)
    },
    onError: (err) => {
      // Staff.HasHistory: a profile with appointments is deactivated, not deleted (D12)
      toast.error(peopleErrorMessage(err, t, deletingMember?.fullName ?? ''))
      setDeletingId(null)
    },
  });

  // The types offered today, plus an older one still on somebody's profile
  const typeChoices = ALL_STAFF_TYPES.filter((type) =>
    SELECTABLE_STAFF_TYPES.includes(type) || type === staffTypeFilter || data?.items.some((m) => m.staffType === type));

  const members = (data?.items ?? []).filter((m) =>
    accessFilter === '' || (accessFilter === 'with' ? !!m.access : !m.access));
  const total = data?.totalCount ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const deletingMember = deletingId ? members.find((m) => m.id === deletingId) : null;

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
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('button.addStaff')}
          </button>
        )}
      </div>

      {/* Filters on the left, search on the right, like the appointment list */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FilterChips
            label={t('filter.type')}
            options={[
              { value: '' as StaffType | '', label: tc('staffType.allTypes') },
              ...typeChoices.map((type) => ({ value: type as StaffType | '', label: t(`staffType.${type}`) })),
            ]}
            value={staffTypeFilter}
            onChange={(v) => { setStaffTypeFilter(v); setPage(1); }}
          />
          <span className="hidden h-4 w-px bg-gray-200 sm:block dark:bg-gray-700" aria-hidden />
          <FilterChips
            label={t('filter.status')}
            options={[
              { value: 'active' as StatusFilter, label: tc('status.active') },
              { value: 'inactive' as StatusFilter, label: tc('status.inactive') },
              { value: 'all' as StatusFilter, label: tc('status.allStatuses') },
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          />
          <span className="hidden h-4 w-px bg-gray-200 sm:block dark:bg-gray-700" aria-hidden />
          <FilterChips
            label={t('filter.access')}
            options={[
              { value: '' as AccessFilter, label: t('filter.anyAccess') },
              { value: 'with' as AccessFilter, label: t('filter.withAccess') },
              { value: 'without' as AccessFilter, label: t('filter.withoutAccess') },
            ]}
            value={accessFilter}
            onChange={setAccessFilter}
          />
        </div>
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          label={t('search.label')}
          placeholder={t('search.placeholder')}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
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
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.access')}</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="text-center py-10 text-gray-500 dark:text-gray-400">
                  {tc('loading')}
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="text-center py-10 text-gray-500 dark:text-gray-400">
                  {t('emptyState')}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => navigate(`/staff/${m.id}`)}>
                  <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400 hover:underline">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t(`staffType.${m.staffType}`)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.email || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">{m.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{m.specialty || '—'}</td>
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
                          ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'
                      }`}
                    >
                      {m.isActive ? tc('status.active') : tc('status.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ACCESS_TONE[accessState(m)]}`}>
                      {t(`access.${accessState(m)}`)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                          className="p-1.5 text-gray-500 hover:text-primary-600 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors dark:text-gray-400"
                          title={tc('button.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(m.id); }}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors dark:text-gray-400"
                          title={tc('button.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
              className="px-3 py-1 rounded border border-control dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {tc('button.prev')}
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-control dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
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

      <ConfirmDialog
        open={!!deletingId}
        title={t('confirm.deleteTitle')}
        description={t('confirm.deleteDescription', { name: deletingMember?.fullName ?? '' })}
        confirmLabel={tc('button.delete')}
        cancelLabel={tc('button.cancel')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
