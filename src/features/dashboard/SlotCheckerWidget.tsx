import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { staffService } from '@/features/staff/services/staffService'

// Clinic working hours and slot granularity
const CLINIC_START_HOUR = 8   // 08:00
const CLINIC_END_HOUR   = 18  // 18:00 (exclusive)
const SLOT_MINUTES      = 30

interface TimeSlot {
  hour: number
  minute: number
  label: string // "08:00", "08:30", …
}

function buildSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = CLINIC_START_HOUR; h < CLINIC_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push({
        hour: h,
        minute: m,
        label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      })
    }
  }
  return slots
}

const ALL_SLOTS = buildSlots() // 20 slots: 08:00 … 17:30

// Statuses that count as "occupying" a slot
const ACTIVE_STATUSES = new Set(['Scheduled', 'CheckedIn', 'InProgress'])

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

export function SlotCheckerWidget() {
  const { t } = useTranslation('dashboard')
  const [date, setDate] = useState(() => toLocalDate(new Date()))
  const [providerId, setProviderId] = useState<string>('all')

  // Reuse the same query key as DashboardPage so the result is cached
  const { data: allStaff } = useQuery({
    queryKey: ['staff-all-active'],
    queryFn: () => staffService.list({ isActive: true, pageSize: 50 }),
    staleTime: 5 * 60 * 1000,
  })

  const providers = useMemo(
    () => (allStaff?.items ?? []).filter(s => ['Dentist', 'Hygienist'].includes(s.staffType)),
    [allStaff],
  )

  const { data: appointments, isFetching } = useQuery({
    queryKey: ['appointments-slot-check', date, providerId],
    queryFn: () =>
      appointmentService.list({
        dateFrom: date,
        dateTo: date,
        ...(providerId !== 'all' ? { providerId } : {}),
        pageSize: 200,
      }),
    staleTime: 30 * 1000,
  })

  // Build the set of busy slot labels for the selected date/provider
  const busySlotLabels = useMemo(() => {
    const busy = new Set<string>()
    for (const appt of appointments?.items ?? []) {
      if (!ACTIVE_STATUSES.has(appt.status)) continue
      const apptStart = new Date(appt.startAt).getTime()
      const apptEnd   = new Date(appt.endAt).getTime()
      for (const slot of ALL_SLOTS) {
        const slotStart = new Date(`${date}T${slot.label}:00`).getTime()
        const slotEnd   = slotStart + SLOT_MINUTES * 60 * 1000
        if (apptStart < slotEnd && apptEnd > slotStart) {
          busy.add(slot.label)
        }
      }
    }
    return busy
  }, [appointments, date])

  const freeCount = ALL_SLOTS.length - busySlotLabels.size
  const bookedCount = busySlotLabels.size

  const isToday = date === toLocalDate(new Date())

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarSearch size={17} className="text-indigo-600 shrink-0" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('slotChecker.title')}</h2>
          {isToday && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-medium">
              {t('slotChecker.todayBadge')}
            </span>
          )}
        </div>
        {isFetching && (
          <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Date navigator */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setDate(d => shiftDate(d, -1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title={t('slotChecker.previousDay')}
          >
            <ChevronLeft size={15} />
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
          />
          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 pl-1 whitespace-nowrap">
            {new Date(date + 'T00:00:00').toLocaleDateString([], { weekday: 'long' })}
          </span>
          <button
            onClick={() => setDate(d => shiftDate(d, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title={t('slotChecker.nextDay')}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Provider filter */}
        <select
          value={providerId}
          onChange={e => setProviderId(e.target.value)}
          className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
        >
          <option value="all">{t('slotChecker.allProviders')}</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>

        {/* Summary badges */}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-green-600 dark:text-green-400">{t('slotChecker.freeCount', { count: freeCount })}</span>
          {' · '}
          <span className="font-semibold text-gray-600 dark:text-gray-300">{t('slotChecker.bookedCount', { count: bookedCount })}</span>
        </span>
      </div>

      {/* Slot grid */}
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
        {ALL_SLOTS.map(slot => {
          const busy = busySlotLabels.has(slot.label)
          if (busy) {
            return (
              <div
                key={slot.label}
                title={t('slotChecker.bookedTooltip')}
                className="rounded-md py-1.5 text-center text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-400 dark:text-red-400 border border-red-100 dark:border-red-800/30 select-none cursor-default"
              >
                {slot.label}
              </div>
            )
          }
          return (
            <Link
              key={slot.label}
              to="/appointments"
              state={{
                openCreate: true,
                date,
                startTime: slot.label,
                providerId: providerId !== 'all' ? providerId : undefined,
              }}
              title={t('slotChecker.freeTooltip')}
              className="rounded-md py-1.5 text-center text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              {slot.label}
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        {t('slotChecker.footer', { startHour: CLINIC_START_HOUR, endHour: CLINIC_END_HOUR })}
      </p>
    </div>
  )
}
