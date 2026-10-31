import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppointmentResponse, AppointmentStatus } from '../services/appointmentService';
import { useAppointmentStatusLabels } from '../hooks/useAppointmentStatusLabels';
import { useTheme } from '@/shared/context/ThemeContext';
import { HOUR_PX, SLOT_MINUTES, calendarHourRange, isoDate, layoutDay, minutesSinceDayStart, useNow } from './calendarGrid';
import { useCalendarDrag } from './useCalendarDrag';
import { AppointmentChipBody, CHIP_LAYOUT } from './AppointmentChipBody';

// The week test imports it from here
export { calendarHourRange };

interface Props {
  weekStart: Date;
  appointments: AppointmentResponse[];
  providerColors: Record<string, string>;
  providerNames: Record<string, string>;
  patientNames: Record<string, string>;
  appointmentTypeNames: Record<string, string>;
  onAppointmentClick?: (appt: AppointmentResponse) => void;
  /** Click on empty time: local "YYYY-MM-DDTHH:mm", rounded down to the half hour. */
  onSlotClick?: (startAt: string) => void;
  /** Drop after a drag: the new local start ("YYYY-MM-DDTHH:mm"); the doctor stays. */
  onMove?: (appt: AppointmentResponse, newStartAt: string, newProviderId?: string) => void;
}

type TooltipState = { appt: AppointmentResponse; x: number; y: number } | null;

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function WeekCalendar({ weekStart, appointments, providerColors, providerNames, patientNames, appointmentTypeNames, onAppointmentClick, onSlotClick, onMove }: Props) {
  const { t } = useTranslation('appointments');
  const dayLabels = t('calendar.weekdays', { returnObjects: true }) as string[];
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const { theme } = useTheme();
  const statusLabels = useAppointmentStatusLabels();
  const isDark = theme === 'dark';

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

  const now = useNow();
  const todayStr = isoDate(now);
  const showsToday = days.some((d) => isoDate(d) === todayStr);
  const nowHour = showsToday ? now.getHours() : null;

  const { start: HOUR_START, end: HOUR_END } = useMemo(
    () => calendarHourRange(appointments, nowHour === null ? undefined : new Date(2000, 0, 1, nowHour)),
    [appointments, nowHour],
  );
  const HOURS = HOUR_END - HOUR_START;
  const totalMinutes = HOURS * 60;
  const drag = useCalendarDrag({ hourStart: HOUR_START, hourEnd: HOUR_END, onMove });
  // Where "now" falls in the grid, or null when the grid does not show this hour
  const nowOffsetMin = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const nowTopPct = nowOffsetMin >= 0 && nowOffsetMin < totalMinutes ? (nowOffsetMin / totalMinutes) * 100 : null;

  // Opacity suffix for chip background: more opaque in dark mode for visibility
  const chipBgOpacity = isDark ? '55' : '28';

  return (
    // Day columns keep a usable minimum width and the week scrolls sideways instead;
    // at 1024px overlapping visits had shrunk to 6px slivers (QA-023).
    <div className="flex flex-col h-full overflow-x-auto overflow-y-hidden">
      {/* Day header */}
      <div className="grid min-w-[57rem] border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-gray-100 dark:border-gray-700/60" />
        {days.map((d, i) => {
          const dateStr = isoDate(d);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center text-xs font-medium border-r border-gray-100 dark:border-gray-700/60 last:border-r-0 ${
                isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div>{dayLabels[i]}</div>
              <div
                className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto flex-1 min-w-[57rem] bg-white dark:bg-gray-900">
        <div className="relative flex" style={{ minHeight: `${HOURS * 56}px` }}>
          {/* Time labels */}
          <div className="w-14 shrink-0">
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className="h-14 border-b border-gray-100 dark:border-gray-700/50 pr-2 text-right text-xs text-gray-500 dark:text-gray-400 pt-0.5"
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
                  data-day={dateStr}
                  data-drop-day={dateStr}
                  onClick={onSlotClick ? (e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    const slot = Math.floor((y / HOUR_PX) * (60 / SLOT_MINUTES));
                    const minutes = Math.min(Math.max(HOUR_START * 60 + slot * SLOT_MINUTES, HOUR_START * 60), HOUR_END * 60 - SLOT_MINUTES);
                    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
                    const mm = String(minutes % 60).padStart(2, '0');
                    onSlotClick(`${dateStr}T${hh}:${mm}`);
                  } : undefined}
                  className={`relative flex-1 border-l border-gray-100 dark:border-gray-700/50 ${
                    isToday ? 'bg-primary-50/20 dark:bg-primary-900/10' : ''
                  } ${onSlotClick ? 'cursor-copy hover:bg-gray-50/60 dark:hover:bg-gray-800/40' : ''}`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-gray-100 dark:border-gray-700/50"
                      style={{ top: `${i * 56}px`, height: '56px' }}
                    />
                  ))}

                  {/* Current time, like Google Calendar: a red line with a dot on today's column */}
                  {isToday && nowTopPct !== null && (
                    <div
                      data-testid="now-line"
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-red-500 dark:bg-red-400"
                      style={{ top: `${nowTopPct}%` }}
                    >
                      <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-500 dark:bg-red-400" />
                    </div>
                  )}

                  {/* Where a dragged visit would land */}
                  {drag.dragged && drag.preview?.day === dateStr && (
                    <div
                      data-testid="drop-preview"
                      className="pointer-events-none absolute inset-x-1 z-30 rounded border-2 border-dashed border-primary-500 bg-primary-50/70 dark:bg-primary-900/40 px-1.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-200"
                      style={{
                        top: `${((drag.preview.startMinutes - HOUR_START * 60) / totalMinutes) * 100}%`,
                        height: `${(drag.dragged.durationMinutes / totalMinutes) * 100}%`,
                      }}
                    >
                      {`${String(Math.floor(drag.preview.startMinutes / 60)).padStart(2, '0')}:${String(drag.preview.startMinutes % 60).padStart(2, '0')}`}
                    </div>
                  )}

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
                    const chipLabel = [patientName, typeName].filter(Boolean).join(' · ') || statusLabels[appt.status as AppointmentStatus];
                    const chip = drag.chipProps(appt);

                    return (
                      <button
                        key={appt.id}
                        onPointerDown={(e) => { setTooltip(null); chip.onPointerDown?.(e); }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (drag.consumeClick()) return;
                          onAppointmentClick?.(appt);
                        }}
                        onMouseEnter={(e) => {
                          if (drag.dragged) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ appt, x: rect.right + 8, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={`absolute ${CHIP_LAYOUT} overflow-hidden rounded text-xs px-1.5 py-0.5 shadow-sm hover:brightness-110 transition select-none ${drag.dragged?.id === appt.id ? 'opacity-40' : ''}`}
                        style={{
                          top: `${topPct}%`,
                          height: `${Math.max(heightPct, 1.5)}%`,
                          left: `calc(${col * widthPct}% + ${col === 0 ? 2 : GAP / 2}px)`,
                          width: `calc(${widthPct}% - ${col === 0 ? 2 + GAP / 2 : GAP}px)`,
                          backgroundColor: color + chipBgOpacity,
                          borderLeft: `3px solid ${color}`,
                          ...chip.style,
                        }}
                      >
                        <AppointmentChipBody
                          time={new Date(appt.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          label={chipLabel}
                          color={color}
                          durationMinutes={appt.durationMinutes}
                          dark={isDark}
                        />
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
        const leftPos = tooltip.x + 220 > window.innerWidth ? tooltip.x - 228 : tooltip.x;
        const topPos  = Math.min(tooltip.y, window.innerHeight - 160);
        return (
          <div
            className="fixed z-[9999] w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-3 pointer-events-none"
            style={{ left: leftPos, top: topPos }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                {providerNames[a.providerId] ?? '—'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
              {patientNames[a.patientId] ?? 'Unknown patient'}
            </p>
            {appointmentTypeNames[a.appointmentTypeId] && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{appointmentTypeNames[a.appointmentTypeId]}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">{startTime} – {endTime} · {a.durationMinutes} min</p>
            <span
              className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: color + '33', color }}
            >
              {statusLabels[a.status as AppointmentStatus] ?? a.status}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
