import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  appointmentService,
  APPOINTMENT_STATUS_LABELS,
  STATUS_COLORS,
  ALL_STATUSES,
  type AppointmentResponse,
  type AppointmentStatus,
} from '../services/appointmentService';
import { staffService } from '@/features/staff/services/staffService';
import { BookAppointmentDrawer } from '../components/BookAppointmentDrawer';
import { RescheduleModal } from '../components/RescheduleModal';
import { WeekCalendar } from '../components/WeekCalendar';
import { useAuthStore } from '@/features/auth/store/authStore';

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
  });
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

  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('list');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showBook, setShowBook] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null);
  const [selected, setSelected] = useState<AppointmentResponse | null>(null);

  // Week calendar state
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59);
    return d;
  }, [weekStart]);

  const listParams = {
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
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

  const { data: calData } = useQuery({
    queryKey: ['appointments-week', weekStart.toISOString()],
    queryFn: () => appointmentService.list(calendarParams),
    enabled: tab === 'calendar',
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff', '', '', 1],
    queryFn: () => staffService.list({ pageSize: 100 }),
  });

  const providerColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of staffData?.items ?? []) {
      if (s.colorHex) map[s.id] = s.colorHex;
    }
    return map;
  }, [staffData]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => appointmentService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSelected(null);
    },
  });

  const appointments = listData?.items ?? [];
  const total = listData?.totalCount ?? 0;
  const pageSize = 20;
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
          <h1 className="text-2xl font-semibold text-gray-900">Appointments</h1>
          {tab === 'list' && (
            <p className="text-sm text-gray-500 mt-0.5">{total} appointment{total !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['list', 'calendar'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === t
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
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
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AppointmentStatus | ''); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Chief Complaint</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listLoading ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="text-center py-10 text-gray-400">Loading…</td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="text-center py-10 text-gray-400">No appointments found.</td>
                  </tr>
                ) : (
                  appointments.map((a: AppointmentResponse) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{formatDate(a.startAt)}</td>
                      <td className="px-4 py-3 text-gray-500">{a.durationMinutes} min</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[a.status as AppointmentStatus] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {a.chiefComplaint ?? '—'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelected(a)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            Actions
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
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Calendar view */
        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
          {/* Week nav */}
          <div className="flex items-center gap-4 py-2">
            <button onClick={prevWeek} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Prev</button>
            <span className="text-sm font-medium text-gray-700">
              {weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })}
              {' — '}
              {weekEnd.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={nextWeek} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Next →</button>
            <button
              onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
              className="px-3 py-1 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
            >
              Today
            </button>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <WeekCalendar
              weekStart={weekStart}
              appointments={calData?.items ?? []}
              providerColors={providerColors}
              onAppointmentClick={setSelected}
            />
          </div>
        </div>
      )}

      {/* Appointment action panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Appointment</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Start:</span> {formatDate(selected.startAt)}</p>
              <p><span className="font-medium">Duration:</span> {selected.durationMinutes} min</p>
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status as AppointmentStatus] ?? ''}`}>
                  {APPOINTMENT_STATUS_LABELS[selected.status as AppointmentStatus] ?? selected.status}
                </span>
              </p>
              {selected.chiefComplaint && (
                <p><span className="font-medium">Complaint:</span> {selected.chiefComplaint}</p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.status !== 'Cancelled' && selected.status !== 'Completed' && (
                  <>
                    <button
                      onClick={() => { setRescheduling(selected); setSelected(null); }}
                      className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(selected.id)}
                      disabled={cancelMutation.isPending}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
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
