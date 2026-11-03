import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { appointmentService, type AppointmentResponse } from '@/features/appointments/services/appointmentService'
import { DayCalendar, type DayProvider } from '@/features/appointments/components/DayCalendar'
import { staffService } from '@/features/staff/services/staffService'
import { tenantService } from '@/features/admin/services/tenantService'
import { daySchedule as scheduleFor, openingHourRange, slotOccupancy } from '@/shared/lib/clinicSchedule'
import { formatTime } from '@/shared/lib/format'
import { localDayEndUtc, localDayStartUtc } from '@/shared/lib/dates'

interface TimeSlot {
  hour: number
  minute: number
  label: string
}

type SlotState = 'free' | 'partial' | 'booked' | 'past'

function buildSlots(startStr: string, endStr: string, durationMinutes: number): TimeSlot[] {
  const [sh, sm] = startStr.split(':').map(Number)
  const [eh, em] = endStr.split(':').map(Number)
  const startTotal = sh * 60 + sm
  const endTotal   = eh * 60 + em

  const slots: TimeSlot[] = []
  for (let t = startTotal; t <= endTotal; t += durationMinutes) {
    const h = Math.floor(t / 60)
    const m = t % 60
    slots.push({
      hour: h,
      minute: m,
      label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    })
  }
  return slots
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return shiftDate(dateStr, -((d.getDay() + 6) % 7))
}

const isOpenOn = (json: string | null | undefined, date: string) => scheduleFor(json, date).isOpen

/** Today when the clinic works today, else the next day it does (within two weeks). */
function firstOpenDayFrom(json: string | null | undefined, from: string): string {
  for (let i = 0; i < 14; i++) {
    const d = shiftDate(from, i)
    if (isOpenOn(json, d)) return d
  }
  return from
}

/**
 * The day at a glance: the clinic's working days, the slots still free, and below them the
 * day's calendar — one column per doctor, or only the doctor chosen.
 */
export function SlotCheckerWidget({ onAppointmentClick }: { onAppointmentClick?: (appt: AppointmentResponse) => void } = {}) {
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { t: ta } = useTranslation('appointments')
  const today = toLocalDate(new Date())
  const [picked, setPicked] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string>('all')

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: tenantService.getSettings,
    staleTime: 10 * 60 * 1000,
  })
  const scheduleJson = settings?.weeklyScheduleJson
  const slotDuration = settings?.slotDurationMinutes ?? 30

  // Until someone picks a day: today, or the next day the clinic works.
  const date = picked ?? firstOpenDayFrom(scheduleJson, today)
  const week = weekStart ?? mondayOf(date)
  // The tabs: the days of this week the clinic is open (Settings → Klinika, QA-018).
  const openDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(week, i)).filter((d) => isOpenOn(scheduleJson, d)),
    [week, scheduleJson],
  )

  const { data: allStaff } = useQuery({
    queryKey: ['staff-all-active'],
    queryFn: () => staffService.list({ isActive: true, pageSize: 50 }),
    staleTime: 5 * 60 * 1000,
  })
  const providers = useMemo(() => (allStaff?.items ?? []).filter(s => s.isBookable), [allStaff])

  // One request for the whole week, so every tab can say how much is still free.
  const { data: appointments, isFetching } = useQuery({
    queryKey: ['appointments-slot-check', week, providerId],
    queryFn: () =>
      appointmentService.list({
        dateFrom: week,
        dateTo: shiftDate(week, 6),
        ...(providerId !== 'all' ? { providerId } : {}),
        pageSize: 200,
      }),
    staleTime: 30 * 1000,
  })

  // "All providers": a slot is free while anyone is free, partly booked when some doctors
  // are busy, and booked only when all of them are. Past slots can't be booked any more.
  const scope = useMemo(
    () => (providerId === 'all' ? providers.map((p) => p.id) : [providerId]),
    [providerId, providers],
  )
  const dayOf = (day: string) => {
    const schedule = scheduleFor(scheduleJson, day)
    const slots = schedule.isOpen ? buildSlots(schedule.start, schedule.end, slotDuration) : []
    const occupancy = slotOccupancy(appointments?.items ?? [], slots, day, slotDuration, scope)
    const now = Date.now()
    const stateOf = (label: string): SlotState => {
      if (new Date(`${day}T${label}:00`).getTime() <= now) return 'past'
      const busy = occupancy.get(label)?.length ?? 0
      if (scope.length === 0 || busy === 0) return 'free'
      return busy === scope.length ? 'booked' : 'partial'
    }
    return { schedule, slots, occupancy, stateOf }
  }
  const current = dayOf(date)
  const states = current.slots.map((s) => current.stateOf(s.label))
  const freeCount    = states.filter((s) => s === 'free').length
  const partialCount = states.filter((s) => s === 'partial').length
  const bookedCount  = states.filter((s) => s === 'booked').length
  const nameOf = (id: string) => providers.find((p) => p.id === id)?.fullName ?? id

  // The calendar under the slots: the chosen day, the chosen doctor (or all of them)
  const { data: types } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
    staleTime: 10 * 60 * 1000,
  })
  const { data: absences } = useQuery({
    queryKey: ['clinic-absences', localDayStartUtc(date), localDayEndUtc(date)],
    queryFn: () => staffService.listClinicAbsences({ from: localDayStartUtc(date), to: localDayEndUtc(date) }),
    staleTime: 60 * 1000,
  })
  const calendarProviders: DayProvider[] = providers
    .filter((p) => providerId === 'all' || p.id === providerId)
    .map((p) => ({ id: p.id, fullName: p.fullName, colorHex: p.colorHex ?? null }))
  const dayAppointments = (appointments?.items ?? []).filter((a) => toLocalDate(new Date(a.startAt)) === date)
  const patientNames = Object.fromEntries(dayAppointments.filter((a) => a.patientName).map((a) => [a.patientId, a.patientName!]))
  const typeNames = Object.fromEntries((types ?? []).map((tp) => [tp.id, tp.name]))

  const weekdays = ta('calendar.weekdays', { returnObjects: true }) as string[]
  const thisWeek = mondayOf(today)
  const goToWeek = (monday: string) => {
    setWeekStart(monday)
    // Land on the first day of that week still worth booking
    const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i)).filter((d) => isOpenOn(scheduleJson, d))
    setPicked(days.find((d) => d >= today) ?? days[0] ?? monday)
  }

  const navButton = 'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-40'
  const slotBase = 'flex h-12 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold tabular-nums transition-colors'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      {/* Header: title, and whose slots */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarSearch size={17} className="text-primary-600 shrink-0 dark:text-primary-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('slotChecker.title')}</h2>
          {isFetching && <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <select
          value={providerId}
          onChange={e => setProviderId(e.target.value)}
          aria-label={t('slotChecker.allProviders')}
          className="text-sm bg-white dark:bg-gray-700 border border-control dark:border-gray-600 rounded-lg px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition"
        >
          <option value="all">{t('slotChecker.allProviders')}</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
      </div>

      {/* The clinic's working days of the week, each with what is still bookable */}
      <div className="flex items-center gap-1 mb-4">
        <button type="button" onClick={() => goToWeek(shiftDate(week, -7))} className={navButton} aria-label={t('slotChecker.prevWeek')} title={t('slotChecker.prevWeek')}>
          <ChevronLeft size={16} />
        </button>
        <div role="tablist" aria-label={t('slotChecker.title')} className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {openDays.map((day) => {
            const d = new Date(day + 'T00:00:00')
            const past = day < today
            const info = dayOf(day)
            const bookable = info.slots.filter((s) => ['free', 'partial'].includes(info.stateOf(s.label))).length
            const selected = day === date
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={past}
                onClick={() => setPicked(day)}
                className={`min-w-[5.5rem] flex-1 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-900/30'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-semibold ${selected ? 'text-primary-700 dark:text-primary-200' : 'text-gray-800 dark:text-gray-100'}`}>{weekdays[(d.getDay() + 6) % 7]}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">{d.getDate()}.{d.getMonth() + 1}.</span>
                  {day === today && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden />}
                </span>
                {!past && (
                  <span className={`block text-xs font-medium ${bookable > 0 ? 'text-green-800 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {bookable > 0 ? t('slotChecker.dayFree', { count: bookable }) : t('slotChecker.dayFull')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => goToWeek(shiftDate(week, 7))} className={navButton} aria-label={t('slotChecker.nextWeek')} title={t('slotChecker.nextWeek')}>
          <ChevronRight size={16} />
        </button>
        {week !== thisWeek && (
          <button type="button" onClick={() => goToWeek(thisWeek)} className="ml-1 whitespace-nowrap rounded-lg border border-primary-300 px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-700 dark:text-primary-300 dark:hover:bg-primary-900/30">
            {t('slotChecker.thisWeek')}
          </button>
        )}
      </div>

      {openDays.length === 0 || !current.schedule.isOpen ? (
        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
          {t('slotChecker.closedDay')}
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-green-700 dark:text-green-400">{t('slotChecker.freeCount', { count: freeCount })}</span>
            {providerId === 'all' && (
              <>
                {' · '}
                <span className="font-semibold text-amber-700 dark:text-amber-300">{t('slotChecker.partialCount', { count: partialCount })}</span>
              </>
            )}
            {' · '}
            <span className="font-semibold text-gray-600 dark:text-gray-300">{t('slotChecker.bookedCount', { count: bookedCount })}</span>
          </p>

          {/* Slots: big enough to hit on a phone and at a glance on the desk */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {current.slots.map(slot => {
              const state = current.stateOf(slot.label)
              if (state === 'past' || state === 'booked') {
                return (
                  <div
                    key={slot.label}
                    data-state={state}
                    title={state === 'past' ? t('slotChecker.pastTooltip') : t('slotChecker.bookedTooltip')}
                    className={`${slotBase} select-none cursor-default ${
                      state === 'past'
                        ? 'border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-500'
                        : 'border-red-100 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-300'
                    }`}
                  >
                    {slot.label}
                  </div>
                )
              }
              if (state === 'partial') {
                const busy = current.occupancy.get(slot.label) ?? []
                const free = scope.filter((id) => !busy.includes(id))
                // Exactly one doctor free: book straight with them.
                const onlyFree = free.length === 1 ? free[0] : undefined
                return (
                  <Link
                    key={slot.label}
                    to="/appointments"
                    state={{ openCreate: true, date, startTime: slot.label, providerId: onlyFree }}
                    data-state="partial"
                    data-free-provider={onlyFree}
                    title={t('slotChecker.partialTooltip', { busy: busy.map(nameOf).join(', '), free: free.map(nameOf).join(', ') })}
                    className={`${slotBase} border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20`}
                  >
                    {slot.label}
                    <span className="text-[11px] font-semibold opacity-80">{busy.length}/{scope.length}</span>
                  </Link>
                )
              }
              return (
                <Link
                  key={slot.label}
                  to="/appointments"
                  state={{ openCreate: true, date, startTime: slot.label, providerId: providerId !== 'all' ? providerId : undefined }}
                  data-state="free"
                  title={t('slotChecker.freeTooltip')}
                  className={`${slotBase} border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40`}
                >
                  {slot.label}
                </Link>
              )
            })}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {t('slotChecker.footer', {
              startHour: formatTime(current.schedule.start),
              endHour:   formatTime(current.slots.length > 0 ? current.slots[current.slots.length - 1].label : current.schedule.end),
              minutes:   slotDuration,
            })}
          </p>

          {/* The day's calendar: what is booked, and room to act on it (opens the visit) */}
          <div className="mt-5 h-[34rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <DayCalendar
              date={date}
              providers={calendarProviders}
              appointments={dayAppointments}
              absences={absences ?? []}
              patientNames={patientNames}
              appointmentTypeNames={typeNames}
              openHours={openingHourRange(scheduleJson, [date])}
              onAppointmentClick={onAppointmentClick}
              onSlotClick={(startAt, doctor) => navigate('/appointments', {
                state: { openCreate: true, date, startTime: startAt.slice(11), providerId: doctor },
              })}
            />
          </div>
        </>
      )}
    </div>
  )
}
