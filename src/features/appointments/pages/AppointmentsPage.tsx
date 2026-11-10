import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppointmentStatusLabels } from '../hooks/useAppointmentStatusLabels';
import {
  appointmentService,
  STATUS_COLORS,
  ALL_STATUSES,
  type AppointmentResponse,
  type AppointmentStatus,
} from '../services/appointmentService';
import { invalidateAppointmentQueries } from '../services/appointmentQueries';
import { staffService } from '@/features/staff/services/staffService';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { BookAppointmentDrawer } from '../components/BookAppointmentDrawer';
import { RescheduleModal } from '../components/RescheduleModal';
import { PeriodPicker } from '../components/PeriodPicker';
import { MonthCalendar } from '../components/MonthCalendar';
import { monthWeeks } from '../components/MiniMonth';
import { WeekCalendar } from '../components/WeekCalendar';
import { onCalendar } from '../components/calendarGrid';
import { DayCalendar, type DayProvider } from '../components/DayCalendar';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { formatDate as formatDay, formatDayMonth, formatMonthYear } from '@/shared/lib/format';
import { toast } from 'sonner';
import { AppointmentDetailPanel } from '../components/AppointmentDetailPanel';
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore';
import { Search, X, Download, CalendarClock, UserRound } from 'lucide-react';
import { localDayEndUtc, localDayStartUtc, toLocalIsoDate } from '@/shared/lib/dates';
import { isClinicMember } from '@/shared/lib/permissions'
import { tenantService } from '@/features/admin/services/tenantService';
import { closedDaysToHide, openingHourRange } from '@/shared/lib/clinicSchedule';

type Tab = 'list' | 'calendar';
type CalendarView = 'week' | 'day' | 'month';

/** Monday = 0, like the week grid. */
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** In the app's language, not the browser's. */
function formatDate(isoStr: string) {
  return formatDayMonth(isoStr, { month: 'short', time: true });
}

const NEXT_STATUS_MAP: Partial<Record<AppointmentStatus, { labelKey: string; next: AppointmentStatus }>> = {
  Scheduled:  { labelKey: 'appointmentAction.checkIn',        next: 'CheckedIn'  },
  CheckedIn:  { labelKey: 'appointmentAction.startTreatment', next: 'InProgress' },
  InProgress: { labelKey: 'appointmentAction.complete',       next: 'Completed'  },
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
        active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300'
      }`}
    >
      {label}
      <span className="text-xs ml-0.5 opacity-70">{active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  );
}

export function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  const { t: tc } = useTranslation('common')
  const statusLabels = useAppointmentStatusLabels()
  const roles = useAuthStore(selectRoles);
  // Every clinic role books and moves appointments (the API also lets the platform admin).
  const canManage = isClinicMember(roles) || roles.includes('SuperAdmin');

  const [searchParams, setSearchParams] = useSearchParams();
  // The calendar is the default view: clinics plan the day on it. The list keeps ?tab=list.
  const tab = (searchParams.get('tab') ?? 'calendar') as Tab;
  const statusFilter = (searchParams.get('status') ?? '') as AppointmentStatus | '';
  const dateFrom = searchParams.get('from') ?? toLocalIsoDate(new Date());
  const dateTo = searchParams.get('to') ?? toLocalIsoDate(new Date());
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const providerFilter = searchParams.get('provider') ?? '';
  const showPast = searchParams.get('past') === '1';

  const updateParam = (key: string, value: string | null, resetPage = true) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      value ? n.set(key, value) : n.delete(key);
      if (resetPage) n.set('page', '1');
      return n;
    }, { replace: true });

  const setTab = (v: Tab) => updateParam('tab', v === 'calendar' ? null : v, false);
  // The calendar shows a week, or one day with a column per doctor (?view=day&day=…)
  const viewParam = searchParams.get('view');
  const calendarView: CalendarView = viewParam === 'day' || viewParam === 'month' ? viewParam : 'week';
  const dayParam = searchParams.get('day');
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : toLocalIsoDate(new Date());
  const setDay = (v: string) => updateParam('day', v, false);
  // The month view (?view=month&month=YYYY-MM)
  const monthParam = searchParams.get('month');
  const ym = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : toLocalIsoDate(new Date()).slice(0, 7);
  const monthStart = useMemo(() => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1), [ym]);
  const setMonth = (v: string) => updateParam('month', v, false);
  const shiftMonth = (n: number) => setMonth(toLocalIsoDate(new Date(monthStart.getFullYear(), monthStart.getMonth() + n, 1)).slice(0, 7));
  const shiftDay = (n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); setDay(toLocalIsoDate(d)); };
  const setStatusFilter = (v: AppointmentStatus | '') => updateParam('status', v || null);
  const setDateFrom = (v: string) => updateParam('from', v || null);
  const setDateTo = (v: string) => updateParam('to', v || null);
  const setPage = (v: number) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('page', String(v)); return n }, { replace: true });
  const setProviderFilter = (v: string) => updateParam('provider', v || null);
  const setShowPast = (v: boolean) => updateParam('past', v ? '1' : null);
  const setDateRange = (from: string, to: string) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.set('from', from);
      n.set('to', to);
      n.delete('past');
      n.set('page', '1');
      return n;
    }, { replace: true });

  const [showBook, setShowBook] = useState(false);
  const [bookingInitial, setBookingInitial] = useState<{ startAt?: string; providerId?: string } | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null);
  const [selected, setSelected] = useState<AppointmentResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ col: 'startAt' | 'duration' | 'status'; dir: 'asc' | 'desc' }>({ col: 'startAt', dir: 'asc' });

  const location = useLocation();
  const handledStateRef = useRef(false);
  useEffect(() => {
    if (handledStateRef.current) return;
    const state = location.state as { openCreate?: boolean; date?: string; startTime?: string; providerId?: string } | null;
    if (state?.openCreate) {
      handledStateRef.current = true;
      const initial: { startAt?: string; providerId?: string } = {};
      if (state.date && state.startTime) initial.startAt = `${state.date}T${state.startTime}`;
      if (state.providerId) initial.providerId = state.providerId;
      setBookingInitial(initial);
      setShowBook(true);
    }
  }, []);

  // Week calendar state
  // DT-24: a link with ?from= opens the calendar on that week.
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const from = searchParams.get('from');
    const fromDate = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : null;
    return getMondayOfWeek(fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : new Date());
  });
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59);
    return d;
  }, [weekStart]);

  // U-01: switching keeps the dates on screen — Day opens in the week shown (today if it is
  // in it, else its Monday), Week opens on the week of the day shown.
  const setCalendarView = (v: CalendarView) => {
    if (v === calendarView) return;
    // To the month the dates on screen are in
    if (v === 'month') {
      const today = new Date();
      const anchor = calendarView === 'day'
        ? day
        : toLocalIsoDate(today >= weekStart && today <= weekEnd ? today : weekStart);
      setSearchParams((p) => {
        const n = new URLSearchParams(p);
        n.set('view', 'month');
        n.set('month', anchor.slice(0, 7));
        return n;
      }, { replace: true });
      return;
    }
    // From the month: today if it is in it, else the 1st
    if (calendarView === 'month') {
      const today = new Date();
      const anchor = toLocalIsoDate(today).slice(0, 7) === ym ? toLocalIsoDate(today) : `${ym}-01`;
      if (v === 'week') {
        setWeekStart(getMondayOfWeek(new Date(`${anchor}T12:00:00`)));
        updateParam('view', null, false);
      } else {
        setSearchParams((p) => {
          const n = new URLSearchParams(p);
          n.set('view', 'day');
          n.set('day', anchor);
          return n;
        }, { replace: true });
      }
      return;
    }
    if (v === 'week') {
      setWeekStart(getMondayOfWeek(new Date(`${day}T12:00:00`)));
      updateParam('view', null, false);
      return;
    }
    const today = new Date();
    const target = today >= weekStart && today <= weekEnd ? today : weekStart;
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.set('view', 'day');
      n.set('day', toLocalIsoDate(target));
      return n;
    }, { replace: true });
  };

  // User request 2026-11-10 (variant B): one switch for Day / Week / List
  type View = CalendarView | 'list';
  const view: View = tab === 'list' ? 'list' : calendarView;
  const selectView = (v: View) => {
    if (v === view) return;
    if (v === 'list') { setTab('list'); return; }
    if (tab === 'list') {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete('tab');
        if (v === 'day') { n.set('view', 'day'); n.set('day', day); }
        else if (v === 'month') { n.set('view', 'month'); n.set('month', ym); }
        else n.delete('view');
        return n;
      }, { replace: true });
      refetchCal();
      return;
    }
    setCalendarView(v);
  };

  const effectiveDateFrom = showPast
    ? (dateFrom || undefined)
    : (dateFrom || toLocalIsoDate(new Date()));

  const listParams = {
    status: statusFilter || undefined,
    dateFrom: effectiveDateFrom,
    dateTo: dateTo || undefined,
    providerId: providerFilter || undefined,
    page,
    pageSize: searchTerm ? 200 : 20,
  };

  const calendarParams = {
    dateFrom: toLocalIsoDate(weekStart),
    dateTo: toLocalIsoDate(weekEnd),
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

  const showMonth = tab === 'calendar' && calendarView === 'month';
  const monthGrid = useMemo(() => monthWeeks(monthStart.getFullYear(), monthStart.getMonth()).flat(), [monthStart]);
  const { data: monthItems } = useQuery({
    queryKey: ['appointments-month', ym],
    // The API gives at most 200 a page; a busy clinic books more than that in a month
    queryFn: async () => {
      const params = { dateFrom: toLocalIsoDate(monthGrid[0]), dateTo: toLocalIsoDate(monthGrid[monthGrid.length - 1]), pageSize: 200 };
      const first = await appointmentService.list({ ...params, page: 1 });
      const pages = Math.ceil(first.totalCount / 200);
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => appointmentService.list({ ...params, page: i + 2 })));
      return [first, ...rest].flatMap((r) => r.items);
    },
    enabled: showMonth,
  });
  const monthVisits = useMemo(() => onCalendar(monthItems ?? []), [monthItems]);

  const showDay = tab === 'calendar' && calendarView === 'day';
  const { data: dayData } = useQuery({
    queryKey: ['appointments-day', day],
    queryFn: () => appointmentService.list({ dateFrom: day, dateTo: day, pageSize: 200 }),
    enabled: showDay,
  });
  const { data: dayAbsences } = useQuery({
    queryKey: ['clinic-absences', localDayStartUtc(day), localDayEndUtc(day)],
    queryFn: () => staffService.listClinicAbsences({ from: localDayStartUtc(day), to: localDayEndUtc(day) }),
    enabled: showDay,
  });

  // The calendar shows the clinic's working hours (plus anything booked outside them)
  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: tenantService.getSettings,
    enabled: tab === 'calendar',
  });
  const openHours = useMemo(() => {
    if (!clinicSettings) return null;
    const dates = calendarView === 'day'
      ? [day]
      : Array.from({ length: 7 }, (_, i) => toLocalIsoDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)));
    return openingHourRange(clinicSettings.weeklyScheduleJson, dates);
  }, [clinicSettings, calendarView, day, weekStart]);

  const { data: apptTypes } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  });

  const { data: staffData } = useQuery({
    // Everyone, inactive included: past appointments keep their provider's name (B6).
    queryKey: ['staff', 'all-for-names'],
    queryFn: () => staffService.list({ pageSize: 100, isActive: 'all' }),
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

  // The appointment lists carry the names; no need to download every patient (QA-033).
  const patientNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of [...(listData?.items ?? []), ...(calData?.items ?? []), ...(dayData?.items ?? [])]) {
      if (a.patientName) map[a.patientId] = a.patientName;
    }
    return map;
  }, [listData, calData, dayData]);

  const appointmentTypeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of apptTypes ?? []) map[t.id] = t.name;
    return map;
  }, [apptTypes]);

  // What the calendars draw: cancelled and no-show visits free their slot
  const weekVisits = useMemo(() => onCalendar(calData?.items ?? []), [calData]);
  // Weekdays left out of the month: closed on every one of them in the grid, none booked
  const hiddenMonthWeekdays = useMemo(() => {
    if (!clinicSettings) return [];
    const dates = monthGrid.map(toLocalIsoDate);
    const hidden = new Set(closedDaysToHide(clinicSettings.weeklyScheduleJson, dates, monthVisits.map((a) => toLocalIsoDate(new Date(a.startAt)))));
    return [0, 1, 2, 3, 4, 5, 6].filter((w) => dates.filter((_, i) => i % 7 === w).every((d) => hidden.has(d)));
  }, [clinicSettings, monthGrid, monthVisits]);

  // User request 2026-11-10: days the clinic is closed are left out of the week, unless booked
  const hiddenWeekDates = useMemo(() => {
    if (!clinicSettings) return [];
    const dates = Array.from({ length: 7 }, (_, i) => toLocalIsoDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)));
    return closedDaysToHide(clinicSettings.weeklyScheduleJson, dates, weekVisits.map((a) => toLocalIsoDate(new Date(a.startAt))));
  }, [clinicSettings, weekStart, weekVisits]);
  const dayVisits = useMemo(() => onCalendar(dayData?.items ?? []), [dayData]);

  // Day view columns: every doctor who takes appointments, plus anyone else who has a visit that day
  const dayProviders = useMemo<DayProvider[]>(() => {
    const busy = new Set(dayVisits.map((a) => a.providerId));
    return (staffData?.items ?? [])
      .filter((s) => (s.isActive && s.isBookable) || busy.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.fullName, colorHex: s.colorHex }));
  }, [staffData, dayVisits]);

  const queryClient = useQueryClient();
  const confirmMove = useConfirm();
  const moveMutation = useMutation({
    mutationFn: ({ appt, startAt, providerId }: { appt: AppointmentResponse; startAt: string; providerId?: string }) => {
      const start = new Date(startAt);
      return appointmentService.reschedule(appt.id, {
        newStartAt: start.toISOString(),
        newEndAt: new Date(start.getTime() + appt.durationMinutes * 60_000).toISOString(),
        ...(providerId ? { newProviderId: providerId } : {}),
      });
    },
    onSuccess: () => { invalidateAppointmentQueries(queryClient); toast.success(t('calendar.moved')); },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, t('calendar.moveFailed'))),
  });
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return `${(t('calendar.weekdaysLong', { returnObjects: true }) as string[])[weekdayIndex(d)]}, ${formatDay(d)}`;
  };
  /** Dropped on the calendar: say where it goes, move it on yes. */
  const askMove = (appt: AppointmentResponse, startAt: string, providerId?: string) => {
    const [date, time] = startAt.split('T');
    confirmMove.ask({
      title: t('calendar.moveTitle'),
      description: (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="font-semibold text-gray-900 dark:text-gray-100">{appt.patientName ?? patientNames[appt.patientId] ?? ''}</div>
          <div className="mt-1.5 flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <CalendarClock size={15} className="shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            <span>{dayLabel(date)} · <span className="font-semibold">{time}</span></span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <UserRound size={15} className="shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            <span>{providerNames[providerId ?? appt.providerId] ?? ''}</span>
          </div>
        </div>
      ),
      confirmLabel: t('calendar.moveConfirm'),
      cancelLabel: t('calendar.moveCancel'),
      tone: 'primary',
      onConfirm: () => moveMutation.mutate({ appt, startAt, providerId }),
    });
  };
  /** A visit's top or bottom edge was pulled: a new start or a new end, same doctor. */
  const resizeMutation = useMutation({
    mutationFn: ({ appt, startAt, endAt }: { appt: AppointmentResponse; startAt: string; endAt: string }) =>
      appointmentService.reschedule(appt.id, {
        newStartAt: new Date(startAt).toISOString(),
        newEndAt: new Date(endAt).toISOString(),
      }),
    onSuccess: () => { invalidateAppointmentQueries(queryClient); toast.success(t('calendar.resized')); },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, t('calendar.resizeFailed'))),
  });
  /** Resized on the calendar: show the new times, save on yes. */
  const askResize = (appt: AppointmentResponse, startAt: string, endAt: string) => {
    const [date, startTime] = startAt.split('T');
    const endTime = endAt.split('T')[1];
    const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
    confirmMove.ask({
      title: t('calendar.resizeTitle'),
      description: (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="font-semibold text-gray-900 dark:text-gray-100">{appt.patientName ?? patientNames[appt.patientId] ?? ''}</div>
          <div className="mt-1.5 flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <CalendarClock size={15} className="shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            <span>{dayLabel(date)} · <span className="font-semibold">{startTime} – {endTime}</span> ({minutes} min)</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <UserRound size={15} className="shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            <span>{providerNames[appt.providerId] ?? ''}</span>
          </div>
        </div>
      ),
      confirmLabel: t('calendar.resizeConfirm'),
      cancelLabel: t('calendar.moveCancel'),
      tone: 'primary',
      onConfirm: () => resizeMutation.mutate({ appt, startAt, endAt }),
    });
  };
  const quickStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: AppointmentStatus }) =>
      appointmentService.updateStatus(id, next),
    onSuccess: () => {
      invalidateAppointmentQueries(queryClient);
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
    link.download = `appointments-${toLocalIsoDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const legendProviders = useMemo(() => {
    const ids = [...new Set(weekVisits.map((a) => a.providerId))];
    return ids
      .map((id) => ({ id, name: providerNames[id] ?? id, color: providerColors[id] }))
      .filter((p) => p.name);
  }, [weekVisits, providerNames, providerColors]);

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
    // DT-25: the chosen column alone decides the order; finished and cancelled rows are
    // marked by their tint, not moved to the end (00:30 sorted after 20:00 when cancelled).
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
  const stepPeriod = (n: 1 | -1) => {
    if (calendarView === 'day') shiftDay(n);
    else if (calendarView === 'month') shiftMonth(n);
    else if (n === 1) nextWeek();
    else prevWeek();
  };
  const goToday = () => {
    if (calendarView === 'day') setDay(toLocalIsoDate(new Date()));
    else if (calendarView === 'month') setMonth(toLocalIsoDate(new Date()).slice(0, 7));
    else setWeekStart(getMondayOfWeek(new Date()));
  };

  // ← / → step the calendar, unless someone is typing or a dialog is open
  useEffect(() => {
    if (tab !== 'calendar') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      stepPeriod(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: the only row above the calendar (variant B) */}
      <div className="flex flex-col gap-3 px-4 pt-6 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 sm:shrink-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
          {tab === 'list' ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {searchTerm && appointments.length !== total
                ? t('filteredOf', { filtered: appointments.length }) + ' '
                : ''}{t('totalCount', { count: total })}
            </p>
          ) : (
            <PeriodPicker
              label={calendarView === 'day' ? dayLabel(day)
                : calendarView === 'month' ? formatMonthYear(monthStart)
                : `${formatDay(weekStart)} — ${formatDay(weekEnd)}`}
              selected={calendarView === 'day' ? day : calendarView === 'month' ? `${ym}-01` : toLocalIsoDate(weekStart)}
              onPick={(date) => {
                if (calendarView === 'day') setDay(date);
                else if (calendarView === 'month') setMonth(date.slice(0, 7));
                else setWeekStart(getMondayOfWeek(new Date(`${date}T12:00:00`)));
              }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Doctors on the week (the day view names its columns instead) */}
          {tab === 'calendar' && calendarView === 'week' && legendProviders.map((p) => (
            <span key={p.id} className="hidden lg:inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6366F1' }} />
              {p.name}
            </span>
          ))}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5">
            {(['day', 'week', 'month', 'list'] as View[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => selectView(v)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === v
                    ? 'bg-white dark:bg-gray-700 shadow-sm ring-1 ring-primary-500 text-primary-700 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {v === 'list' ? t('tab.list') : t(`calendar.${v}`)}
              </button>
            ))}
          </div>
          {tab === 'calendar' && (
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
            >
              {t('calendar.today')}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowBook(true)}
              className="flex-1 sm:flex-none whitespace-nowrap px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('button.bookAppointment')}
            </button>
          )}
        </div>
      </div>

      {tab === 'list' ? (
        <div className="flex-1 overflow-auto px-4 sm:px-6 space-y-4 pb-6">
          {/* Filters */}
          <div className="space-y-2">
            {/* Row 1: Search + Export */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none dark:text-gray-400" />
                <input
                  type="text"
                  aria-label={t('filter.search')}
                  placeholder={t('search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="w-full border border-control dark:border-gray-600 rounded-lg pl-8 pr-8 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {searchTerm && (
                  <button
                    aria-label={t('filter.clearSearch')}
                    onClick={() => { setSearchTerm(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 dark:text-gray-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-control dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                <Download size={14} />
                {tc('button.exportCsv')}
              </button>
            </div>

            {/* Row 2: Presets + date pickers + dropdowns + show past */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date presets */}
              {(() => {
                const now = new Date();
                const todayS = toLocalIsoDate(now);
                const mon = getMondayOfWeek(now);
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                const fom = new Date(now.getFullYear(), now.getMonth(), 1);
                const lom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return ([
                  { label: t('preset.today'), from: todayS, to: todayS },
                  { label: t('preset.thisWeek'), from: toLocalIsoDate(mon), to: toLocalIsoDate(sun) },
                  { label: t('preset.thisMonth'), from: toLocalIsoDate(fom), to: toLocalIsoDate(lom) },
                ] as const).map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setDateRange(p.from, p.to)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      dateFrom === p.from && dateTo === p.to
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-control dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ));
              })()}

              <div className="h-4 w-px bg-gray-200" />

              <input
                type="date"
                aria-label={t('filter.from')}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-control dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-500 dark:text-gray-400 text-xs">→</span>
              <input
                type="date"
                aria-label={t('filter.to')}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-control dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              <div className="h-4 w-px bg-gray-200" />

              <select
                aria-label={t('filter.status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
                className="border border-control dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('filter.allStatuses')}</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{statusLabels[s]}</option>
                ))}
              </select>

              <select
                aria-label={t('filter.provider')}
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="border border-control dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('filter.allProviders')}</option>
                {/* Only people who take appointments (DT-25); names of others still resolve from staffData */}
                {(staffData?.items ?? []).filter((s) => s.isBookable).map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 cursor-pointer select-none ml-1">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => setShowPast(e.target.checked)}
                  className="rounded border-control dark:border-gray-600"
                />
                {t('filter.showPast')}
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3"><SortBtn label={t('table.start')} col="startAt" sort={sort} onClick={() => toggleSort('startAt')} /></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.patient')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.provider')}</th>
                  <th className="text-left px-4 py-3"><SortBtn label={t('table.duration')} col="duration" sort={sort} onClick={() => toggleSort('duration')} /></th>
                  <th className="text-left px-4 py-3"><SortBtn label={t('table.status')} col="status" sort={sort} onClick={() => toggleSort('status')} /></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{t('table.chiefComplaint')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">{tc('loading')}</td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">{t('emptyState')}</td>
                  </tr>
                ) : (
                  appointments.map((a: AppointmentResponse) => {
                    const color = providerColors[a.providerId];
                    const nextAction = NEXT_STATUS_MAP[a.status as AppointmentStatus];
                    return (
                      <tr
                        key={a.id}
                        className={`group cursor-pointer ${
                          a.status === 'Completed' ? 'bg-gray-50/70 dark:bg-gray-800/40 opacity-75' :
                          a.status === 'Cancelled' ? 'bg-red-50/50 dark:bg-red-950/20' :
                          a.status === 'NoShow'    ? 'bg-red-50/30 dark:bg-red-950/10' :
                          'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
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
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.durationMinutes} {tc('unit.min')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={a.status} colorMap={STATUS_COLORS} labelMap={statusLabels} />
                            {canManage && nextAction && (
                              <button
                                onClick={(e) => { e.stopPropagation(); quickStatusMutation.mutate({ id: a.id, next: nextAction.next }); }}
                                className="invisible group-hover:visible inline-flex items-center px-1.5 py-0.5 text-xs text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors whitespace-nowrap"
                              >
                                → {tc(nextAction.labelKey)}
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
              <span>{tc('pagination.showingRange', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded border border-control dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">{tc('button.prev')}</button>
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded border border-control dark:border-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">{tc('button.next')}</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Calendar view */
        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 pb-6">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {calendarView === 'month' ? (
              <MonthCalendar
                year={monthStart.getFullYear()}
                month={monthStart.getMonth()}
                appointments={monthVisits}
                providerColors={providerColors}
                providerNames={providerNames}
                hiddenWeekdays={hiddenMonthWeekdays}
                onDayClick={(date) => setSearchParams((prev) => {
                  const n = new URLSearchParams(prev);
                  n.set('view', 'day');
                  n.set('day', date);
                  return n;
                }, { replace: true })}
                onPrev={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
              />
            ) : calendarView === 'day' ? (
              <DayCalendar
                date={day}
                providers={dayProviders}
                appointments={dayVisits}
                absences={dayAbsences ?? []}
                patientNames={patientNames}
                appointmentTypeNames={appointmentTypeNames}
                onAppointmentClick={setSelected}
                onSlotClick={canManage ? (startAt, providerId) => { setBookingInitial({ startAt, providerId }); setShowBook(true); } : undefined}
                onMove={canManage ? askMove : undefined}
                onResize={canManage ? askResize : undefined}
                openHours={openHours}
                onPrev={() => shiftDay(-1)}
                onNext={() => shiftDay(1)}
              />
            ) : (
            <WeekCalendar
              weekStart={weekStart}
              appointments={weekVisits}
              hiddenDates={hiddenWeekDates}
              providerColors={providerColors}
              providerNames={providerNames}
              patientNames={patientNames}
              appointmentTypeNames={appointmentTypeNames}
              onAppointmentClick={setSelected}
              onSlotClick={canManage ? (startAt) => { setBookingInitial({ startAt }); setShowBook(true); } : undefined}
              onMove={canManage ? askMove : undefined}
                onResize={canManage ? askResize : undefined}
              openHours={openHours}
              onPrev={prevWeek}
              onNext={nextWeek}
              onDayClick={(date) => setSearchParams((prev) => {
                const n = new URLSearchParams(prev);
                n.set('view', 'day');
                n.set('day', date);
                return n;
              }, { replace: true })}
            />
            )}
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

      {showBook && (
        <BookAppointmentDrawer
          onClose={() => { setShowBook(false); setBookingInitial(null); }}
          initialStartAt={bookingInitial?.startAt}
          initialProviderId={bookingInitial?.providerId}
        />
      )}
      {confirmMove.dialog}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
        />
      )}
    </div>
  );
}
