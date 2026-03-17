import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CalendarDays, Users, UserCog, Clock, TrendingUp, CheckCircle2, CalendarPlus, UserPlus } from 'lucide-react'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { patientService } from '@/features/patients/services/patientService'
import { staffService } from '@/features/staff/services/staffService'

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  if (to) return <Link to={to}>{inner}</Link>
  return inner
}

interface RecentApptRowProps {
  time: string
  status: string
  statusColor: string
  complaint: string | null
  duration: number
}

function RecentApptRow({ time, status, statusColor, complaint, duration }: RecentApptRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{time}</div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>{status}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span>{complaint ?? '—'}</span>
        <span>{duration} min</span>
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Scheduled', Confirmed: 'Confirmed', CheckedIn: 'Checked In',
  InChair: 'In Chair', Completed: 'Completed', Cancelled: 'Cancelled',
  NoShow: 'No Show', Rescheduled: 'Rescheduled',
}

const STATUS_COLORS: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Confirmed: 'bg-green-100 text-green-700',
  CheckedIn: 'bg-yellow-100 text-yellow-700',
  InChair: 'bg-orange-100 text-orange-700',
  Completed: 'bg-gray-100 text-gray-600',
  Cancelled: 'bg-red-100 text-red-600',
  NoShow: 'bg-red-50 text-red-400',
  Rescheduled: 'bg-purple-100 text-purple-700',
}

export function DashboardPage() {
  const today = toLocalDateStr(new Date())
  const tomorrow = toLocalDateStr(new Date(Date.now() + 86400000))

  const { data: todayAppts } = useQuery({
    queryKey: ['appointments-today', today],
    queryFn: () => appointmentService.list({ dateFrom: today, dateTo: today, pageSize: 50 }),
  })

  const { data: pendingAppts } = useQuery({
    queryKey: ['appointments-pending'],
    queryFn: () => appointmentService.list({ status: 'Scheduled', pageSize: 1 }),
  })

  const { data: confirmedAppts } = useQuery({
    queryKey: ['appointments-confirmed'],
    queryFn: () => appointmentService.list({ status: 'Confirmed', pageSize: 1 }),
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

  const todayCount = todayAppts?.totalCount ?? 0
  const pendingCount = (pendingAppts?.totalCount ?? 0) + (confirmedAppts?.totalCount ?? 0)
  const patientCount = patients?.totalCount ?? 0
  const staffCount = staff?.totalCount ?? 0
  const tomorrowCount = tomorrowAppts?.totalCount ?? 0

  const recentAppointments = todayAppts?.items.slice(0, 8) ?? []
  const completedToday = todayAppts?.items.filter(a => a.status === 'Completed').length ?? 0
  const doneOrGone = todayAppts?.items.filter(a =>
    ['Completed', 'NoShow', 'Cancelled'].includes(a.status)
  ).length ?? 0

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/appointments"
          state={{ openCreate: true }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <CalendarPlus size={16} />
          Book Appointment
        </Link>
        <Link
          to="/patients"
          state={{ openCreate: true }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <UserPlus size={16} />
          Register Patient
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          label="Today's Appointments"
          value={todayCount}
          icon={CalendarDays}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          sub={`${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
          to="/appointments"
        />
        <StatCard
          label="Pending Confirmation"
          value={pendingCount}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub="Scheduled + Confirmed"
          to="/appointments"
        />
        <StatCard
          label="Total Patients"
          value={patientCount}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub="Active records"
          to="/patients"
        />
        <StatCard
          label="Active Staff"
          value={staffCount}
          icon={UserCog}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          sub="Providers & admin"
          to="/staff"
        />
        <StatCard
          label="Tomorrow"
          value={tomorrowCount}
          icon={CalendarDays}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          sub="Appointments booked"
          to="/appointments"
        />
      </div>

      {/* Today's schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Today's Schedule</h2>
            {todayCount > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {completedToday} of {todayCount} completed
              </span>
            )}
          </div>
          <Link
            to="/appointments"
            className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
          >
            View all →
          </Link>
        </div>

        {todayCount > 0 && (
          <div className="mb-4">
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round((doneOrGone / todayCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {recentAppointments.length === 0 ? (
          <div className="py-8 text-center">
            <TrendingUp size={28} className="mx-auto text-gray-200 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No appointments scheduled for today.</p>
            <Link
              to="/appointments"
              className="mt-2 inline-block text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Book one now →
            </Link>
          </div>
        ) : (
          <div>
            {recentAppointments.map((a) => (
              <RecentApptRow
                key={a.id}
                time={formatTime(a.startAt)}
                status={STATUS_LABELS[a.status] ?? a.status}
                statusColor={STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}
                complaint={a.chiefComplaint}
                duration={a.durationMinutes}
              />
            ))}
            {todayCount > 8 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-3">
                +{todayCount - 8} more —{' '}
                <Link to="/appointments" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  view all
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Appointments by provider */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCog size={16} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Today by Provider</h2>
        </div>
        <div className="space-y-3">
          {byProvider.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No clinical providers found.</p>
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
                    <span className="text-xs text-gray-400 dark:text-gray-500">{member.staffType}</span>
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
    </div>
  )
}
