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
import { ListPeriodPanel } from '../components/ListPeriodPanel';
import { avatarTint, initialsOf } from '@/features/patients/lib/patientDisplay';
import { MonthCalendar } from '../components/MonthCalendar';
import { monthWeeks } from '../components/MiniMonth';
import { WeekCalendar } from '../components/WeekCalendar';
import { onCalendar } from '../components/calendarGrid';
import { DayCalendar, type DayProvider } from '../components/DayCalendar';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { formatDate as formatDay, formatDayMonth, formatMonthYear, formatWeekRange } from '@/shared/lib/format';
import { toast } from 'sonner';
import type { PatientSearchResult } from '@/features/patients/services/patientService';
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
  CheckedIn:  { labelKey: 'appointmentAction.complete',       next: 'Completed'  }, // no "Start treatment" step (2026-11-11)
  InProgress: { labelKey: 'appointmentAction.complete',       next: 'Completed'  },
};

/** Every visit in a period: the API gives at most 200 a page, a busy month has more. */
async function listAll(params: { dateFrom: string; dateTo: string }) {
  const first = await appointmentService.list({ ...params, pageSize: 200, page: 1 });
  const pages = Math.ceil(first.totalCount / 200);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => appointmentService.list({ ...params, pageSize: 200, page: i + 2 })));
  return [first, ...rest].flatMap((r) => r.items);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const timeOf = (iso: string) => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

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
  const isoDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const dateFrom = isoDay(searchParams.get('from')) ?? toLocalIsoDate(new Date());
  const dateTo = [isoDay(searchParams.get('to')) ?? dateFrom, dateFrom].sort()[1];

  const updateParam = (key: string, value: string | null) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      value ? n.set(key, value) : n.delete(key);
      return n;
    }, { replace: true });

  const setTab = (v: Tab) => updateParam('tab', v === 'calendar' ? null : v);
  // The calendar shows a week, or one day with a column per doctor (?view=day&day=…)
  const viewParam = searchParams.get('view');
  const calendarView: CalendarView = viewParam === 'day' || viewParam === 'month' ? viewParam : 'week';
  const dayParam = searchParams.get('day');
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : toLocalIsoDate(new Date());
  const setDay = (v: string) => updateParam('day', v);
  // Doctor filter (user request 2026-11-10): ?doctors=id,id; none = everyone
  const doctorsParam = searchParams.get('doctors') ?? '';
  const selectedDoctors = useMemo(() => new Set(doctorsParam ? doctorsParam.split(',') : []), [doctorsParam]);
  const toggleDoctor = (id: string) => {
    const next = new Set(selectedDoctors);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateParam('doctors', [...next].join(',') || null);
  };
  const forChosenDoctors = <T extends { providerId: string }>(items: T[]) =>
    selectedDoctors.size ? items.filter((a) => selectedDoctors.has(a.providerId)) : items;
  // The month view (?view=month&month=YYYY-MM)
  const monthParam = searchParams.get('month');
  const ym = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : toLocalIsoDate(new Date()).slice(0, 7);
  const monthStart = useMemo(() => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1), [ym]);
  const setMonth = (v: string) => updateParam('month', v);
  const shiftMonth = (n: number) => setMonth(toLocalIsoDate(new Date(monthStart.getFullYear(), monthStart.getMonth() + n, 1)).slice(0, 7));
  const shiftDay = (n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); setDay(toLocalIsoDate(d)); };
  const setStatusFilter = (v: AppointmentStatus | '') => updateParam('status', v || null);
  const setDateRange = (from: string, to: string) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.set('from', from);
      n.set('to', to);
      return n;
    }, { replace: true });
  // The list's arrows move the period by its own length: a day, a week, a month of days
  const shiftRange = (dir: 1 | -1) => {
    const a = new Date(`${dateFrom}T12:00:00`);
    const b = new Date(`${dateTo}T12:00:00`);
    const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
    a.setDate(a.getDate() + dir * days);
    b.setDate(b.getDate() + dir * days);
    setDateRange(toLocalIsoDate(a), toLocalIsoDate(b));
  };

  const [showBook, setShowBook] = useState(false);
  const [bookingInitial, setBookingInitial] = useState<{ startAt?: string; providerId?: string; patient?: PatientSearchResult } | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null);
  const [selected, setSelected] = useState<AppointmentResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
        updateParam('view', null);
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
      updateParam('view', null);
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

  const calendarParams = {
    dateFrom: toLocalIsoDate(weekStart),
    dateTo: toLocalIsoDate(weekEnd),
    pageSize: 200,
  };

  // The list loads its whole period, then filters by doctor, status and text on the page,
  // so the status buttons can count and several doctors can be chosen at once
  const { data: listItems, isLoading: listLoading } = useQuery({
    queryKey: ['appointments', 'list', dateFrom, dateTo],
    queryFn: () => listAll({ dateFrom, dateTo }),
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
    queryFn: () => listAll({ dateFrom: toLocalIsoDate(monthGrid[0]), dateTo: toLocalIsoDate(monthGrid[monthGrid.length - 1]) }),
    enabled: showMonth,
  });
  // The month counts visits that happen: no-shows are left out too
  const monthVisits = useMemo(
    () => forChosenDoctors(onCalendar(monthItems ?? []).filter((a) => a.status !== 'NoShow')),
    [monthItems, selectedDoctors],
  );

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
    for (const a of [...(listItems ?? []), ...(calData?.items ?? []), ...(dayData?.items ?? [])]) {
      if (a.patientName) map[a.patientId] = a.patientName;
    }
    return map;
  }, [listItems, calData, dayData]);

  const appointmentTypeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of apptTypes ?? []) map[t.id] = t.name;
    return map;
  }, [apptTypes]);

  // What the calendars draw: cancelled and no-show visits free their slot
  const weekVisits = useMemo(() => forChosenDoctors(onCalendar(calData?.items ?? [])), [calData, selectedDoctors]);
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
  const dayVisits = useMemo(() => forChosenDoctors(onCalendar(dayData?.items ?? [])), [dayData, selectedDoctors]);

  // Day view columns: every doctor who takes appointments, plus anyone else who has a visit that day
  const dayProviders = useMemo<DayProvider[]>(() => {
    const busy = new Set(dayVisits.map((a) => a.providerId));
    return (staffData?.items ?? [])
      .filter((s) => (s.isActive && s.isBookable) || busy.has(s.id))
      .filter((s) => !selectedDoctors.size || selectedDoctors.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.fullName, colorHex: s.colorHex }));
  }, [staffData, dayVisits, selectedDoctors]);

  // One button per doctor who takes appointments
  const doctorChips = useMemo(
    () => (staffData?.items ?? []).filter((s) => s.isActive && s.isBookable),
    [staffData],
  );

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

  // Doctor and text first: the status buttons count what is left after them
  const listBase = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return forChosenDoctors(listItems ?? [])
      .filter((a) => !q
        || (patientNames[a.patientId] ?? '').toLowerCase().includes(q)
        || (a.chiefComplaint ?? '').toLowerCase().includes(q))
      // DT-25: start time alone decides the order; a cancelled 00:30 stays before 20:00
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [listItems, searchTerm, patientNames, selectedDoctors]);
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<AppointmentStatus, number>> = {};
    for (const a of listBase) counts[a.status as AppointmentStatus] = (counts[a.status as AppointmentStatus] ?? 0) + 1;
    return counts;
  }, [listBase]);
  const appointments = useMemo(
    () => (statusFilter ? listBase.filter((a) => a.status === statusFilter) : listBase),
    [listBase, statusFilter],
  );
  const listDays = useMemo(() => {
    const days: { date: string; items: AppointmentResponse[] }[] = [];
    for (const a of appointments) {
      const date = toLocalIsoDate(new Date(a.startAt));
      if (days[days.length - 1]?.date !== date) days.push({ date, items: [] });
      days[days.length - 1].items.push(a);
    }
    return days;
  }, [appointments]);
  const listDayLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const prefix = iso === toLocalIsoDate(today) ? `${t('preset.today')} · ` : iso === toLocalIsoDate(tomorrow) ? `${t('list.tomorrow')} · ` : '';
    return `${prefix}${(t('calendar.weekdaysLong', { returnObjects: true }) as string[])[weekdayIndex(d)]}, ${formatDayMonth(d, { month: 'long' })}`;
  };

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

  // ← / → step the calendar or the list, unless someone is typing or a dialog is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (tab === 'list') shiftRange(dir); else stepPeriod(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: the only row above the calendar (variant B) */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 px-4 pt-6 pb-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
          {tab === 'list' ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('totalCount', { count: appointments.length })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3 sm:self-start">
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
          {canManage && (
            <button
              onClick={() => setShowBook(true)}
              className="flex-1 sm:flex-none whitespace-nowrap px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('button.bookAppointment')}
            </button>
          )}
        </div>
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
              {tab === 'list' ? (
                <PeriodPicker
                  label={dateFrom === dateTo ? dayLabel(dateFrom) : formatWeekRange(new Date(`${dateFrom}T12:00:00`), new Date(`${dateTo}T12:00:00`))}
                  panelLabel={t('list.choosePeriod')}
                  panel={(close) => <ListPeriodPanel from={dateFrom} to={dateTo} onChange={setDateRange} onDone={close} />}
                  onPrev={() => shiftRange(-1)}
                  onNext={() => shiftRange(1)}
                  prevLabel={t('list.prevPeriod')}
                  nextLabel={t('list.nextPeriod')}
                />
              ) : (
              <PeriodPicker
                label={calendarView === 'day' ? dayLabel(day)
                  : calendarView === 'month' ? formatMonthYear(monthStart)
                  : formatWeekRange(weekStart, weekEnd)}
                selected={calendarView === 'day' ? day : calendarView === 'month' ? `${ym}-01` : toLocalIsoDate(weekStart)}
                onPick={(date) => {
                  if (calendarView === 'day') setDay(date);
                  else if (calendarView === 'month') setMonth(date.slice(0, 7));
                  else setWeekStart(getMondayOfWeek(new Date(`${date}T12:00:00`)));
                }}
                onPrev={() => stepPeriod(-1)}
                onNext={() => stepPeriod(1)}
                prevLabel={t(calendarView === 'day' ? 'calendar.prevDay' : calendarView === 'month' ? 'calendar.prevMonth' : 'calendar.prevWeek')}
                nextLabel={t(calendarView === 'day' ? 'calendar.nextDay' : calendarView === 'month' ? 'calendar.nextMonth' : 'calendar.nextWeek')}
              />
              )}
              {/* Doctor filter: a click shows only that doctor; several can be on */}
              {doctorChips.length > 1 && (
                <div role="group" aria-label={t('calendar.doctorsFilter')} className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={selectedDoctors.size === 0}
                    onClick={() => updateParam('doctors', null)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedDoctors.size === 0
                        ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/60 dark:bg-primary-500/20 dark:text-primary-200'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    {t('calendar.allDoctors')}
                  </button>
                  {doctorChips.map((s) => {
                    const on = selectedDoctors.has(s.id);
                    const color = s.colorHex ?? '#6366F1';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDoctor(s.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          on
                            ? 'text-gray-900 dark:text-white'
                            : `border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 ${selectedDoctors.size ? 'opacity-60 hover:opacity-100' : ''}`
                        }`}
                        style={on ? { borderColor: color, backgroundColor: `${color}26` } : undefined}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                        {s.fullName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
      </div>

      {tab === 'list' ? (
        <div className="flex-1 overflow-auto px-4 sm:px-6 space-y-3 pb-6">
          {/* Status buttons with their counts; search and export on the right */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label={t('filter.status')} className="flex flex-wrap items-center gap-1.5">
              {(['', ...ALL_STATUSES.filter((s) => statusCounts[s] || s === statusFilter)] as (AppointmentStatus | '')[]).map((s) => {
                const on = statusFilter === s;
                return (
                  <button
                    key={s || 'all'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on
                        ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/60 dark:bg-primary-500/20 dark:text-primary-200'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    {s ? statusLabels[s] : t('filter.allStatuses')}
                    <span className={`tabular-nums ${on ? '' : 'text-gray-400 dark:text-gray-500'}`}>{s ? statusCounts[s] ?? 0 : listBase.length}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-56 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none dark:text-gray-400" aria-hidden />
                <input
                  type="text"
                  aria-label={t('filter.search')}
                  placeholder={t('search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-full border border-control dark:border-gray-600 rounded-lg pl-8 pr-8 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label={t('filter.clearSearch')}
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={exportCSV}
                aria-label={tc('button.exportCsv')}
                title={tc('button.exportCsv')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Download size={15} aria-hidden />
              </button>
            </div>
          </div>

          {/* The visits, a block per day */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs">
                <tr>
                  <th className="w-24 px-4 py-3 text-left font-medium">{t('table.time')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('table.patient')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('table.service')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('table.provider')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('table.status')}</th>
                </tr>
              </thead>
              {listLoading ? (
                <tbody><tr><td colSpan={5} className="px-4 py-10 text-center text-gray-600 dark:text-gray-400">{tc('loading')}</td></tr></tbody>
              ) : listDays.length === 0 ? (
                <tbody><tr><td colSpan={5} className="px-4 py-10 text-center text-gray-600 dark:text-gray-400">{t('emptyState')}</td></tr></tbody>
              ) : listDays.map(({ date, items }) => {
                const label = listDayLabel(date);
                return (
                  <tbody key={date} aria-label={label} className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                    <tr className="bg-gray-50/70 dark:bg-gray-900/40">
                      <th scope="rowgroup" colSpan={5} className="px-4 py-2 text-left text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {label}
                        <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">· {t('totalCount', { count: items.length })}</span>
                      </th>
                    </tr>
                    {items.map((a) => {
                      const color = providerColors[a.providerId];
                      const name = patientNames[a.patientId] ?? '—';
                      const nextAction = NEXT_STATUS_MAP[a.status as AppointmentStatus];
                      const gone = a.status === 'Cancelled' || a.status === 'NoShow';
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className={`group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${gone ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-2.5 align-top">
                            <p className={`font-medium tabular-nums text-gray-900 dark:text-gray-100 ${gone ? 'line-through' : ''}`}>{timeOf(a.startAt)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{a.durationMinutes} {tc('unit.min')}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(a.patientId)}`} aria-hidden>{initialsOf(name)}</div>
                              <span className="truncate font-medium text-gray-900 dark:text-gray-100">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 max-w-xs">
                            <p className="truncate text-gray-700 dark:text-gray-300">{appointmentTypeNames[a.appointmentTypeId] ?? '—'}</p>
                            {a.chiefComplaint && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{a.chiefComplaint}</p>}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#9CA3AF' }} aria-hidden />
                              {providerNames[a.providerId] ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={a.status} colorMap={STATUS_COLORS} labelMap={statusLabels} />
                              {canManage && nextAction && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); quickStatusMutation.mutate({ id: a.id, next: nextAction.next }); }}
                                  className="invisible group-hover:visible focus:visible inline-flex items-center px-1.5 py-0.5 text-xs text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors whitespace-nowrap"
                                >
                                  → {tc(nextAction.labelKey)}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
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
          // A no-show or cancelled visit: book the same patient with the same doctor again
          onRebook={canManage ? (a) => {
            setBookingInitial({
              providerId: a.providerId,
              // The panel has just loaded this patient: keep their card number in the form
              patient: {
                id: a.patientId,
                fullName: a.patientName ?? patientNames[a.patientId] ?? '',
                patientNumber: queryClient.getQueryData<{ patientNumber: string | null }>(['patient', a.patientId])?.patientNumber ?? null,
                phoneMobile: null,
                email: null,
              },
            });
            setSelected(null);
            setShowBook(true);
          } : undefined}
          canManage={canManage}
        />
      )}

      {showBook && (
        <BookAppointmentDrawer
          onClose={() => { setShowBook(false); setBookingInitial(null); }}
          initialStartAt={bookingInitial?.startAt}
          initialProviderId={bookingInitial?.providerId}
          initialPatient={bookingInitial?.patient}
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
