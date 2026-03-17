import { useMemo, useState } from 'react';
import type { AppointmentResponse, AppointmentStatus } from '../services/appointmentService';
import { APPOINTMENT_STATUS_LABELS } from '../services/appointmentService';

interface Props {
  weekStart: Date;
  appointments: AppointmentResponse[];
  providerColors: Record<string, string>;
  providerNames: Record<string, string>;
  patientNames: Record<string, string>;
  appointmentTypeNames: Record<string, string>;
  onAppointmentClick?: (appt: AppointmentResponse) => void;
}

type TooltipState = { appt: AppointmentResponse; x: number; y: number } | null;

const HOUR_START = 6;  // 06:00
const HOUR_END   = 21; // 21:00
const HOURS      = HOUR_END - HOUR_START; // 15

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

/** Assigns a column index and total columns count to each appointment so that
 *  overlapping appointments are rendered side-by-side rather than stacked. */
function layoutDay(appts: AppointmentResponse[]): Map<string, { col: number; cols: number }> {
  // Sort by start time
  const sorted = [...appts].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  // Each "cluster" is a group of mutually-overlapping appointments
  const layout = new Map<string, { col: number; cols: number }>();
  const clusters: AppointmentResponse[][] = [];

  for (const appt of sorted) {
    const apptStart = new Date(appt.startAt).getTime();
    const apptEnd = new Date(appt.endAt).getTime();

    // Find a cluster whose end time overlaps with this appt
    let placed = false;
    for (const cluster of clusters) {
      const clusterEnd = Math.max(...cluster.map((a) => new Date(a.endAt).getTime()));
      if (apptStart < clusterEnd) {
        cluster.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([appt]);
  }

  for (const cluster of clusters) {
    const cols = cluster.length;
    cluster.forEach((appt, colIdx) => {
      layout.set(appt.id, { col: colIdx, cols });
    });
  }

  return layout;
}

export function WeekCalendar({ weekStart, appointments, providerColors, providerNames, patientNames, appointmentTypeNames, onAppointmentClick }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
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
              const dayLayout = layoutDay(dayAppts);

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
                    const { col, cols } = dayLayout.get(appt.id) ?? { col: 0, cols: 1 };
                    const GAP = 2;
                    const widthPct = 100 / cols;

                    const patientName = patientNames[appt.patientId];
                    const typeName = appointmentTypeNames[appt.appointmentTypeId];
                    const chipLabel = [patientName, typeName].filter(Boolean).join(' · ') || APPOINTMENT_STATUS_LABELS[appt.status as AppointmentStatus];

                    return (
                      <button
                        key={appt.id}
                        onClick={() => onAppointmentClick?.(appt)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ appt, x: rect.right + 8, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className="absolute overflow-hidden rounded text-left text-xs px-1.5 py-0.5 shadow-sm hover:brightness-95 transition"
                        style={{
                          top: `${topPct}%`,
                          height: `${Math.max(heightPct, 1.5)}%`,
                          left: `calc(${col * widthPct}% + ${col === 0 ? 2 : GAP / 2}px)`,
                          width: `calc(${widthPct}% - ${col === 0 ? 2 + GAP / 2 : GAP}px)`,
                          backgroundColor: color + '33',
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <span className="font-semibold truncate block" style={{ color }}>
                          {new Date(appt.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="truncate block text-gray-700">{chipLabel}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (() => {
        const a = tooltip.appt;
        const color = a.colorHex ?? providerColors[a.providerId] ?? '#6366F1';
        const startTime = new Date(a.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime   = new Date(a.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        // Clamp to viewport
        const leftPos = tooltip.x + 220 > window.innerWidth ? tooltip.x - 228 : tooltip.x;
        const topPos  = Math.min(tooltip.y, window.innerHeight - 160);
        return (
          <div
            className="fixed z-[9999] w-52 rounded-xl border border-gray-200 bg-white shadow-xl p-3 pointer-events-none"
            style={{ left: leftPos, top: topPos }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-gray-800 truncate">
                {providerNames[a.providerId] ?? '—'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 leading-snug">
              {patientNames[a.patientId] ?? 'Unknown patient'}
            </p>
            {appointmentTypeNames[a.appointmentTypeId] && (
              <p className="text-xs text-gray-500 mt-0.5">{appointmentTypeNames[a.appointmentTypeId]}</p>
            )}
            <p className="text-xs text-gray-500 mt-1 tabular-nums">{startTime} – {endTime} · {a.durationMinutes} min</p>
            <span
              className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: color + '22', color }}
            >
              {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
