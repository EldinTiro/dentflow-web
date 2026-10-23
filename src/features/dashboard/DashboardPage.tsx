import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, Users, UserCog, Clock, TrendingUp, TrendingDown,
  CheckCircle2, CalendarPlus, UserPlus, DollarSign, Wallet, Bell,
} from 'lucide-react'
import { appointmentService, AppointmentStatus, STATUS_COLORS, APPOINTMENT_STATUS_LABELS, type AppointmentResponse } from '@/features/appointments/services/appointmentService'
import { AppointmentDetailPanel } from '@/features/appointments/components/AppointmentDetailPanel'
import { RescheduleModal } from '@/features/appointments/components/RescheduleModal'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { canViewFinance } from '@/shared/lib/permissions'
import { patientService } from '@/features/patients/services/patientService'
import { staffService } from '@/features/staff/services/staffService'
import { dashboardService } from './dashboardService'
import { SlotCheckerWidget } from './SlotCheckerWidget'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { toLocalIsoDate } from '@/shared/lib/dates'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  sub?: string
  to?: string
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub, to }: StatCardProps) {
  const inner = (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-start gap-4 min-w-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight break-words text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs leading-tight break-words text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  if (to) return <Link to={to}>{inner}</Link>
  return inner
}

interface RecentApptRowProps {
  time: string
  status: AppointmentStatus
  complaint: string | null
  duration: number
  patientName?: string
  providerName?: string
  onOpen: () => void
}

function RecentApptRow({ time, status, complaint, duration, patientName, providerName, onOpen }: RecentApptRowProps) {
  const rowBg =
    status === 'Completed' ? 'bg-gray-50/80 dark:bg-gray-800/50 opacity-70' :
    status === 'Cancelled' ? 'bg-red-50/60 dark:bg-red-950/20' :
    status === 'NoShow'    ? 'bg-red-50/40 dark:bg-red-950/10' : ''
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left flex items-center justify-between py-3 px-2 -mx-2 rounded-lg border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${rowBg}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 shrink-0">{time}</div>
        <StatusBadge status={status} colorMap={STATUS_COLORS} labelMap={APPOINTMENT_STATUS_LABELS} className="shrink-0" />
        {patientName && (
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{patientName}</span>
        )}
        {providerName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">· {providerName}</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
        {complaint && <span className="truncate max-w-[120px] hidden md:block">{complaint}</span>}
        <span>{duration} min</span>
      </div>
    </button>
  )
}


export function DashboardPage() {
  const [selected, setSelected] = useState<AppointmentResponse | null>(null)
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null)
  const roles = useAuthStore(selectRoles)
  // Same rule as AppointmentsPage: who may change an appointment's status.
  const canManage = ['ClinicOwner', 'ClinicAdmin', 'Receptionist', 'Dentist', 'Hygienist', 'SuperAdmin'].some((r) => roles.includes(r))
  const { t, i18n } = useTranslation('dashboard')

  const localeMap: Record<string, string> = { bs: 'hr', en: 'en', de: 'de' }
  const displayLocale = localeMap[i18n.language] ?? i18n.language
  const today = toLocalIsoDate(new Date())
  const tomorrow = toLocalIsoDate(new Date(Date.now() + 86400000))

  const { data: todayAppts } = useQuery({
    queryKey: ['appointments-today', today],
    queryFn: () => appointmentService.list({ dateFrom: today, dateTo: today, pageSize: 50 }),
  })

  // Upcoming only: past visits nobody updated are not waiting for confirmation (QA-035).
  const { data: pendingAppts } = useQuery({
    queryKey: ['appointments-pending', today],
    queryFn: () => appointmentService.list({ status: 'Scheduled', dateFrom: today, pageSize: 1 }),
  })

  const { data: patients } = useQuery({
    queryKey: ['patients-total'],
    queryFn: () => patientService.list({ pageSize: 1 }),
  })

  const { data: staff } = useQuery({
    queryKey: ['staff-active'],
    queryFn: () => staffService.list({ isActive: true, pageSize: 1 }),
  })

  const { data: tomorrowAppts } = useQuery({
    queryKey: ['appointments-tomorrow', tomorrow],
    queryFn: () => appointmentService.list({ dateFrom: tomorrow, dateTo: tomorrow, pageSize: 1 }),
  })

  const { data: allStaff } = useQuery({
    queryKey: ['staff-all-active'],
    queryFn: () => staffService.list({ isActive: true, pageSize: 50 }),
  })

  const { data: kpi } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })

  // Clinic money is only requested by roles that may see it (finance.view).
  const canFinance = canViewFinance(roles)
  const { data: finance } = useQuery({
    queryKey: ['dashboard-finance'],
    queryFn: () => dashboardService.getFinance(),
    enabled: canFinance,
    staleTime: 60_000,
  })

  const todayCount = todayAppts?.totalCount ?? 0
  const pendingCount = pendingAppts?.totalCount ?? 0
  const patientCount = patients?.totalCount ?? 0
  const staffCount = staff?.totalCount ?? 0
  const tomorrowCount = tomorrowAppts?.totalCount ?? 0

  const revenueThisMonth = finance?.revenueThisMonth ?? 0
  const outstandingBalance = finance?.outstandingBalance ?? 0
  const newPatientsThisMonth = kpi?.newPatientsThisMonth ?? 0
  const completedThisWeek = kpi?.appointmentsCompletedThisWeek ?? 0
  const completedLastWeek = kpi?.appointmentsCompletedLastWeek ?? 0
  const recallDueSoon = kpi?.recallDueSoon ?? 0
  const recallOverdue = kpi?.recallOverdue ?? 0

  const weeklyTrend = completedThisWeek - completedLastWeek

  const recentAppointments = todayAppts?.items.slice(0, 8) ?? []
  const completedToday = todayAppts?.items.filter(a => a.status === 'Completed').length ?? 0
  const doneOrGone = todayAppts?.items.filter(a =>
    ['Completed', 'NoShow', 'Cancelled'].includes(a.status)
  ).length ?? 0

  const providerNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allStaff?.items ?? []) map[s.id] = s.fullName
    return map
  }, [allStaff])

  // The appointment list carries the names; no need to download every patient (QA-033).
  const patientNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of todayAppts?.items ?? []) if (a.patientName) map[a.patientId] = a.patientName
    return map
  }, [todayAppts])

  const byProvider = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const a of todayAppts?.items ?? []) {
      countMap.set(a.providerId, (countMap.get(a.providerId) ?? 0) + 1)
    }
    const providers = (allStaff?.items ?? []).filter(s =>
      ['Dentist', 'Hygienist'].includes(s.staffType)
    )
    return providers
      .map(member => ({ id: member.id, count: countMap.get(member.id) ?? 0, member }))
      .sort((a, b) => b.count - a.count)
  }, [todayAppts, allStaff])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date().toLocaleDateString(displayLocale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/appointments"
          state={{ openCreate: true }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          <CalendarPlus size={16} />
          {t('quickAction.bookAppointment')}
        </Link>
        <Link
          to="/patients"
          state={{ openCreate: true }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <UserPlus size={16} />
          {t('quickAction.registerPatient')}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t('stat.todaysAppointments')}
          value={todayCount}
          icon={CalendarDays}
          iconBg="bg-primary-50 dark:bg-primary-400/10"
          iconColor="text-primary-600 dark:text-primary-400"
          sub={`${new Date().toLocaleDateString(displayLocale, { month: 'short', day: 'numeric' })}`}
          to="/appointments"
        />
        <StatCard
          label={t('stat.pendingConfirmation')}
          value={pendingCount}
          icon={Clock}
          iconBg="bg-amber-50 dark:bg-amber-400/10"
          iconColor="text-amber-600"
          sub={t('stat.upcomingScheduled')}
          to="/appointments"
        />
        <StatCard
          label={t('stat.totalPatients')}
          value={patientCount}
          icon={Users}
          iconBg="bg-blue-50 dark:bg-blue-400/10"
          iconColor="text-blue-600"
          sub={t('stat.activeRecords')}
          to="/patients"
        />
        <StatCard
          label={t('stat.activeStaff')}
          value={staffCount}
          icon={UserCog}
          iconBg="bg-green-50 dark:bg-green-400/10"
          iconColor="text-green-700"
          sub={t('stat.providersAndAdmin')}
          to="/staff"
        />
        <StatCard
          label={t('stat.tomorrow')}
          value={tomorrowCount}
          icon={CalendarDays}
          iconBg="bg-violet-50 dark:bg-violet-400/10"
          iconColor="text-violet-600"
          sub={t('stat.appointmentsBooked')}
          to="/appointments"
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {canFinance && (<>
        <StatCard
          label={t('stat.revenueThisMonth')}
          value={`${revenueThisMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} KM`}
          icon={DollarSign}
          iconBg="bg-emerald-50 dark:bg-emerald-400/10"
          iconColor="text-emerald-600"
          sub={t('stat.thisMonth')}
          to="/finance"
        />
        <StatCard
          label={t('stat.outstandingBalance')}
          value={`${outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} KM`}
          icon={Wallet}
          iconBg="bg-orange-50 dark:bg-orange-400/10"
          iconColor="text-orange-500"
          sub={t('stat.unpaidInvoices')}
          to="/finance/debtors"
        />
        </>)}
        <StatCard
          label={t('stat.newPatientsThisMonth')}
          value={newPatientsThisMonth}
          icon={UserPlus}
          iconBg="bg-purple-50 dark:bg-purple-400/10"
          iconColor="text-purple-600"
          sub={t('stat.firstVisitThisMonth')}
          to="/patients"
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-400/10">
            <CheckCircle2 size={22} className="text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('stat.completedThisWeek')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{completedThisWeek}</p>
            <p className="text-xs mt-0.5 flex items-center gap-1">
              {weeklyTrend > 0 ? (
                <><TrendingUp size={12} className="text-emerald-500" /><span className="text-emerald-600">+{weeklyTrend} {t('stat.vsLastWeek')}</span></>
              ) : weeklyTrend < 0 ? (
                <><TrendingDown size={12} className="text-red-400" /><span className="text-red-500">{weeklyTrend} {t('stat.vsLastWeek')}</span></>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">{t('stat.vsLastWeekSame')}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Recall alerts */}
      {(recallDueSoon > 0 || recallOverdue > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('recall.title')}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {recallOverdue > 0 && (
              <Link to="/patients?recallFilter=overdue" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:shadow-sm transition-shadow">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{recallOverdue}</span>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('recall.overdue')}</span>
              </Link>
            )}
            {recallDueSoon > 0 && (
              <Link to="/patients?recallFilter=due-soon" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:shadow-sm transition-shadow">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{recallDueSoon}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t('recall.dueSoon')}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Today's schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('schedule.title')}</h2>
            {todayCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('schedule.completedOfTotal', { completed: completedToday, total: todayCount })}
              </span>
            )}
          </div>
          <Link
            to="/appointments"
            className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
          >
            {t('schedule.viewAll')}
          </Link>
        </div>

        {todayCount > 0 && (
          <div className="mb-4">
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.round((doneOrGone / todayCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {recentAppointments.length === 0 ? (
          <div className="py-8 text-center">
            <TrendingUp size={28} className="mx-auto text-gray-200 dark:text-gray-500 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('schedule.emptyState')}</p>
            <Link
              to="/appointments"
              className="mt-2 inline-block text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('schedule.bookNow')}
            </Link>
          </div>
        ) : (
          <div>
            {recentAppointments.map((a) => (
              <RecentApptRow
                key={a.id}
                time={formatTime(a.startAt)}
                status={a.status}
                complaint={a.chiefComplaint}
                duration={a.durationMinutes}
                patientName={patientNames[a.patientId]}
                providerName={providerNames[a.providerId]}
                onOpen={() => setSelected(a)}
              />
            ))}
            {todayCount > 8 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-3">
                {t('schedule.moreCount', { count: todayCount - 8 })}{' '}
                <Link to="/appointments" className="text-primary-600 dark:text-primary-400 hover:underline">
                  {t('schedule.viewAllLink')}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Appointments by provider */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCog size={16} className="text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('provider.title')}</h2>
        </div>
        <div className="space-y-3">
          {byProvider.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{t('provider.emptyState')}</p>
          ) : (
            byProvider.map(({ id, count, member }) => (
              <div key={id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: member.colorHex ?? '#6366f1' }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{member.fullName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{member.staffType}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: todayCount > 0 ? `${Math.round((count / todayCount) * 100)}%` : '0%',
                      backgroundColor: member.colorHex ?? '#6366f1',
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick slot availability check */}
      <SlotCheckerWidget />

      {/* Act on today's visits without leaving the dashboard */}
      {selected && (
        <AppointmentDetailPanel
          appointment={selected}
          onClose={() => setSelected(null)}
          onReschedule={(a) => { setRescheduling(a); setSelected(null) }}
          canManage={canManage}
        />
      )}
      {rescheduling && <RescheduleModal appointment={rescheduling} onClose={() => setRescheduling(null)} />}
    </div>
  )
}
