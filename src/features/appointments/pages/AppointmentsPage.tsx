import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  appointmentService,
  APPOINTMENT_STATUS_LABELS,
  STATUS_COLORS,
  ALL_STATUSES,
  type AppointmentResponse,
  type AppointmentStatus,
} from '../services/appointmentService';
import { staffService } from '@/features/staff/services/staffService';
import { patientService } from '@/features/patients/services/patientService';
import { BookAppointmentDrawer } from '../components/BookAppointmentDrawer';
import { RescheduleModal } from '../components/RescheduleModal';
import { WeekCalendar } from '../components/WeekCalendar';
import { AppointmentDetailPanel } from '../components/AppointmentDetailPanel';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Search, X, Download } from 'lucide-react';

type Tab = 'list' | 'calendar';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const NEXT_STATUS_MAP: Partial<Record<AppointmentStatus, { label: string; next: AppointmentStatus }>> = {
  Scheduled: { label: 'Confirm', next: 'Confirmed' },
  Confirmed: { label: 'Check In', next: 'CheckedIn' },
  CheckedIn: { label: 'Seat', next: 'InChair' },
  InChair: { label: 'Complete', next: 'Completed' },
};

function SortBtn({ label, col, sort, onClick }: {
  label: string;
  col: 'startAt' | 'duration' | 'status';
  sort: { col: string; dir: 'asc' | 'desc' };
  onClick: () => void;
}) {
  const active = sort.col === col;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 font-medium whitespace-nowrap hover:text-gray-900 ${
        active ? 'text-indigo-600' : 'text-gray-600'
      }`}
    >
      {label}
      <span className="text-xs ml-0.5 opacity-70">{active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  );
}

export function AppointmentsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage =
    roles.includes('ClinicOwner') ||
    roles.includes('ClinicAdmin') ||
    roles.includes('Receptionist') ||
    roles.includes('Dentist') ||
    roles.includes('Hygienist') ||
    roles.includes('SuperAdmin');

  const [tab, setTab] = useState<Tab>('list');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState(() => toLocalDateStr(new Date()));
  const [dateTo, setDateTo] = useState(() => toLocalDateStr(new Date()));
  const [page, setPage] = useState(1);
  const [showBook, setShowBook] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null);
  const [selected, setSelected] = useState<AppointmentResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [sort, setSort] = useState<{ col: 'startAt' | 'duration' | 'status'; dir: 'asc' | 'desc' }>({ col: 'startAt', dir: 'asc' });

  // Week calendar state
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59);
    return d;
  }, [weekStart]);

  const effectiveDateFrom = showPast
    ? (dateFrom || undefined)
    : (dateFrom || toLocalDateStr(new Date()));

  const listParams = {
    status: statusFilter || undefined,
    dateFrom: effectiveDateFrom,
    dateTo: dateTo || undefined,
    providerId: providerFilter || undefined,
    page,
    pageSize: searchTerm ? 200 : 20,
  };

  const calendarParams = {
    dateFrom: toLocalDateStr(weekStart),
    dateTo: toLocalDateStr(weekEnd),
    pageSize: 200,
  };

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['appointments', listParams],
    queryFn: () => appointmentService.list(listParams),
    enabled: tab === 'list',
  });

  const { data: calData, refetch: refetchCal } = useQuery({
    queryKey: ['appointments-week', weekStart.toISOString()],
    queryFn: () => appointmentService.list(calendarParams),
  });

  const { data: apptTypes } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff', '', '', 1],
    queryFn: () => staffService.list({ pageSize: 100 }),
  });

  const { data: patientsData } = useQuery({
    queryKey: ['patients-all'],
    queryFn: () => patientService.list({ pageSize: 500 }),
  });

  const providerColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of staffData?.items ?? []) {
      if (s.colorHex) map[s.id] = s.colorHex;
    }
    return map;
  }, [staffData]);

  const providerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of staffData?.items ?? []) map[s.id] = s.fullName;
    return map;
  }, [staffData]);

  const patientNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of patientsData?.items ?? []) map[p.id] = p.fullName;
    return map;
  }, [patientsData]);

  const appointmentTypeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of apptTypes ?? []) map[t.id] = t.name;
    return map;
  }, [apptTypes]);

  const queryClient = useQueryClient();
  const quickStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: AppointmentStatus }) =>
      appointmentService.updateStatus(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] });
    },
  });

  function toggleSort(col: 'startAt' | 'duration' | 'status') {
    setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    setPage(1);
  }

  function exportCSV() {
    const rows = [
      ['Date/Time', 'Patient', 'Provider', 'Duration (min)', 'Status', 'Chief Complaint'],
      ...appointments.map((a) => [
        formatDate(a.startAt),
        patientNames[a.patientId] ?? '',
        providerNames[a.providerId] ?? '',
        String(a.durationMinutes),
        a.status,
        a.chiefComplaint ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointments-${toLocalDateStr(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const legendProviders = useMemo(() => {
    const ids = [...new Set((calData?.items ?? []).map((a) => a.providerId))];
    return ids
      .map((id) => ({ id, name: providerNames[id] ?? id, color: providerColors[id] }))
      .filter((p) => p.name);
  }, [calData, providerNames, providerColors]);

  const rawAppointments = listData?.items ?? [];
  const appointments = useMemo(() => {
    let result = [...rawAppointments];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          (patientNames[a.patientId] ?? '').toLowerCase().includes(q) ||
          (a.chiefComplaint ?? '').toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sort.col === 'startAt') cmp = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      else if (sort.col === 'duration') cmp = a.durationMinutes - b.durationMinutes;
      else if (sort.col === 'status') cmp = a.status.localeCompare(b.status);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [rawAppointments, searchTerm, patientNames, sort]);

  const total = listData?.totalCount ?? 0;
  const pageSize = searchTerm ? 200 : 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const prevWeek = () => {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  };
  const nextWeek = () => {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Appointments</h1>
          {tab === 'list' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {searchTerm && appointments.length !== total
                ? `${appointments.length} of `
                : ''}{total} appointment{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5">
            {(['list', 'calendar'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === 'calendar') refetchCal();
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === t
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t === 'list' ? 'List' : 'Calendar'}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              onClick={() => setShowBook(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Book Appointment
            </button>
          )}
        </div>
      </div>

      {tab === 'list' ? (
        <div className="flex-1 overflow-auto px-6 space-y-4 pb-6">
          {/* Filters */}
          <div className="space-y-2">
            {/* Row 1: Search + Export */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search patient or chief complaint…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-8 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>

            {/* Row 2: Presets + date pickers + dropdowns + show past */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date presets */}
              {(() => {
                const now = new Date();
                const todayS = toLocalDateStr(now);
                const mon = getMondayOfWeek(now);
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                const fom = new Date(now.getFullYear(), now.getMonth(), 1);
                const lom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return ([
                  { label: 'Today', from: todayS, to: todayS },
                  { label: 'This Week', from: toLocalDateStr(mon), to: toLocalDateStr(sun) },
                  { label: 'This Month', from: toLocalDateStr(fom), to: toLocalDateStr(lom) },
                ] as const).map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to); setShowPast(false); setPage(1); }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      dateFrom === p.from && dateTo === p.to
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ));
              })()}

              <div className="h-4 w-px bg-gray-200" />

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-400 dark:text-gray-500 text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="h-4 w-px bg-gray-200" />

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as AppointmentStatus | ''); setPage(1); }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
                ))}
              </select>

              <select
                value={providerFilter}
                onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All providers</option>
                {(staffData?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 cursor-pointer select-none ml-1">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => { setShowPast(e.target.checked); setPage(1); }}
                  className="rounded border-gray-300"
                />
                Show past
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3"><SortBtn label="Start" col="startAt" sort={sort} onClick={() => toggleSort('startAt')} /></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Provider</th>
                  <th className="text-left px-4 py-3"><SortBtn label="Duration" col="duration" sort={sort} onClick={() => toggleSort('duration')} /></th>
                  <th className="text-left px-4 py-3"><SortBtn label="Status" col="status" sort={sort} onClick={() => toggleSort('status')} /></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Chief Complaint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">No appointments found.</td>
                  </tr>
                ) : (
                  appointments.map((a: AppointmentResponse) => {
                    const color = providerColors[a.providerId];
                    const nextAction = NEXT_STATUS_MAP[a.status as AppointmentStatus];
                    return (
                      <tr
                        key={a.id}
                        className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        style={color ? { borderLeft: `3px solid ${color}` } : undefined}
                        onClick={() => setSelected(a)}
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium tabular-nums">{formatDate(a.startAt)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{patientNames[a.patientId] ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            {color && (
                              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            )}
                            {providerNames[a.providerId] ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.durationMinutes} min</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                STATUS_COLORS[a.status as AppointmentStatus] ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                            </span>
                            {canManage && nextAction && (
                              <button
                                onClick={(e) => { e.stopPropagation(); quickStatusMutation.mutate({ id: a.id, next: nextAction.next }); }}
                                className="invisible group-hover:visible inline-flex items-center px-1.5 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors whitespace-nowrap"
                              >
                                → {nextAction.label}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {a.chiefComplaint ?? '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!searchTerm && totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Calendar view */
        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
          {/* Week nav */}
          <div className="flex items-center gap-4 py-2">
            <button onClick={prevWeek} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">← Prev</button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })}
              {' — '}
              {weekEnd.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={nextWeek} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Next →</button>
            <button
              onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
              className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            >
              Today
            </button>
          </div>

          {/* Provider legend */}
          {legendProviders.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2">
              {legendProviders.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color ?? '#6366F1' }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{p.name}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <WeekCalendar
              weekStart={weekStart}
              appointments={calData?.items ?? []}
              providerColors={providerColors}
              providerNames={providerNames}
              patientNames={patientNames}
              appointmentTypeNames={appointmentTypeNames}
              onAppointmentClick={setSelected}
            />
          </div>
        </div>
      )}

      {/* Appointment detail panel */}
      {selected && (
        <AppointmentDetailPanel
          appointment={selected}
          onClose={() => setSelected(null)}
          onReschedule={(a) => { setRescheduling(a); setSelected(null); }}
          canManage={canManage}
        />
      )}

      {showBook && <BookAppointmentDrawer onClose={() => setShowBook(false)} />}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
        />
      )}
    </div>
  );
}
