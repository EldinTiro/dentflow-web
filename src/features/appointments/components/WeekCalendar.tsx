import { useMemo } from 'react';
import type { AppointmentResponse, AppointmentStatus } from '../services/appointmentService';
import { APPOINTMENT_STATUS_LABELS } from '../services/appointmentService';

interface Props {
  weekStart: Date; // Monday of the displayed week
  appointments: AppointmentResponse[];
  /**
   * Map from providerId → colorHex (from staffService results)
   */
  providerColors: Record<string, string>;
  onAppointmentClick?: (appt: AppointmentResponse) => void;
}

const HOUR_START = 7;  // 07:00
const HOUR_END   = 20; // 20:00
const HOURS      = HOUR_END - HOUR_START; // 13

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d: Date) {
  // Use local time parts — toISOString() gives UTC date which mismatches local midnight
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minutesSinceDayStart(iso: string) {
  const d = new Date(iso);
  // getHours/getMinutes already return local time
  return d.getHours() * 60 + d.getMinutes();
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekCalendar({ weekStart, appointments, providerColors, onAppointmentClick }: Props) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map: Record<string, AppointmentResponse[]> = {};
    for (const appt of appointments) {
      const key = isoDate(new Date(appt.startAt));
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    return map;
  }, [appointments]);

  const totalMinutes = HOURS * 60;
  const todayStr = isoDate(new Date());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day header */}
      <div className="grid border-b border-gray-200 bg-white" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-gray-100" />
        {days.map((d, i) => {
          const dateStr = isoDate(d);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center text-xs font-medium border-r border-gray-100 last:border-r-0 ${
                isToday ? 'text-indigo-700' : 'text-gray-500'
              }`}
            >
              <div>{DAY_LABELS[i]}</div>
              <div
                className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-indigo-600 text-white' : 'text-gray-800'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto flex-1">
        <div className="relative flex" style={{ minHeight: `${HOURS * 56}px` }}>
          {/* Time labels */}
          <div className="w-14 shrink-0">
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className="h-14 border-b border-gray-100 pr-2 text-right text-xs text-gray-400 pt-0.5"
                style={{ lineHeight: '14px' }}
              >
                {`${String(HOUR_START + i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1">
            {days.map((d, colIdx) => {
              const dateStr = isoDate(d);
              const dayAppts = byDay[dateStr] ?? [];
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={colIdx}
                  className={`relative flex-1 border-l border-gray-100 ${
                    isToday ? 'bg-indigo-50/20' : ''
                  }`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-gray-100"
                      style={{ top: `${i * 56}px`, height: '56px' }}
                    />
                  ))}

                  {/* Appointment chips */}
                  {dayAppts.map((appt) => {
                    const startMin = minutesSinceDayStart(appt.startAt);
                    const offsetMin = startMin - HOUR_START * 60;
                    if (offsetMin < 0 || offsetMin >= totalMinutes) return null;

                    const topPct = (offsetMin / totalMinutes) * 100;
                    const heightPct = (appt.durationMinutes / totalMinutes) * 100;
                    const color = appt.colorHex ?? providerColors[appt.providerId] ?? '#6366F1';

                    return (
                      <button
                        key={appt.id}
                        onClick={() => onAppointmentClick?.(appt)}
                        className="absolute left-0.5 right-0.5 overflow-hidden rounded text-left text-xs px-1.5 py-0.5 shadow-sm hover:brightness-95 transition"
                        style={{
                          top: `${topPct}%`,
                          height: `${Math.max(heightPct, 1.5)}%`,
                          backgroundColor: color + '33', // 20% opacity background
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <span className="font-semibold truncate block" style={{ color }}>
                          {new Date(appt.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="truncate block text-gray-700">
                          {APPOINTMENT_STATUS_LABELS[appt.status as AppointmentStatus]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
