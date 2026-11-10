import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppointmentResponse, AppointmentStatus } from '../services/appointmentService';
import { useAppointmentStatusLabels } from '../hooks/useAppointmentStatusLabels';
import { useTheme } from '@/shared/context/ThemeContext';
import { useHourHeight, calendarHourRange, isoDate, layoutDay, minutesSinceDayStart, useNow } from './calendarGrid';
import { SlotPreview, hhmm, isOverSomething, slotUnderPointer } from './SlotPreview';
import { useCalendarDrag } from './useCalendarDrag';
import { AppointmentChipBody, CHIP_LAYOUT, chipColors } from './AppointmentChipBody';

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
  /** Step to the previous / next week (arrows at both ends of the day header). */
  onPrev?: () => void;
  onNext?: () => void;
  /** A click on a day's header (local "YYYY-MM-DD"): open that day. */
  onDayClick?: (date: string) => void;
  /** Clinic opening hours (whole hours) the grid shows; defaults to 06:00–21:00. */
  openHours?: { start: number; end: number } | null;
}

type TooltipState = { appt: AppointmentResponse; x: number; y: number } | null;

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Time labels, seven days, and the next-week arrow: the same in header and grid. */
const WEEK_COLUMNS = '56px repeat(7, minmax(0, 1fr)) 48px';
const WEEK_HEADER_PX = 58;

export function WeekCalendar({ weekStart, appointments, providerColors, providerNames, patientNames, appointmentTypeNames, onAppointmentClick, onSlotClick, onMove, openHours, onPrev, onNext, onDayClick }: Props) {
  const { t } = useTranslation('appointments');
  const dayLabels = t('calendar.weekdays', { returnObjects: true }) as string[];
  // Full names where there is room; phones keep the short ones
  const dayLabelsLong = t('calendar.weekdaysLong', { returnObjects: true }) as string[];
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [hover, setHover] = useState<{ day: string; minutes: number } | null>(null);
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
    () => calendarHourRange(appointments, nowHour === null ? undefined : new Date(2000, 0, 1, nowHour), openHours),
    [appointments, nowHour, openHours],
  );
  const HOURS = HOUR_END - HOUR_START;
  const totalMinutes = HOURS * 60;
  // Hours fill the space the calendar has, at least MIN_hourPx each (15 min = one line)
  const [scrollRef, hourPx] = useHourHeight(HOURS, WEEK_HEADER_PX);
  const drag = useCalendarDrag({ hourStart: HOUR_START, hourEnd: HOUR_END, hourPx, onMove });
  // Where "now" falls in the grid, or null when the grid does not show this hour
  const nowOffsetMin = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const nowTopPct = nowOffsetMin >= 0 && nowOffsetMin < totalMinutes ? (nowOffsetMin / totalMinutes) * 100 : null;


  return (
    // Day columns keep a usable minimum width and the week scrolls sideways instead;
    // at 1024px overlapping visits had shrunk to 6px slivers (QA-023).
    // One scroll box with a sticky header, and one column template for header and grid:
    // the grid's own scrollbar used to make its columns narrower than the header's.
    <div ref={scrollRef} className="h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="min-w-[57rem]">
      {/* Day header */}
      <div className="sticky top-0 z-30 grid border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" style={{ gridTemplateColumns: WEEK_COLUMNS, height: WEEK_HEADER_PX }}>
        <div className="flex items-center justify-center">
          {onPrev && (
            <button type="button" onClick={onPrev} aria-label={t('calendar.prevWeek')} className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
        {days.map((d, i) => {
          const dateStr = isoDate(d);
          const isToday = dateStr === todayStr;
          const label = (
            <>
              <div><span className="sm:hidden">{dayLabels[i]}</span><span className="hidden sm:inline">{dayLabelsLong[i]}</span></div>
              <div
                className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {d.getDate()}
              </div>
            </>
          );
          const cellClass = `px-2 py-2 text-center text-xs font-medium border-l border-gray-200 dark:border-gray-700/60 ${
            isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
          }`;
          // User request 2026-11-10: a click on a day opens it
          return onDayClick ? (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(dateStr)}
              aria-label={t('calendar.openDay', { day: `${dayLabelsLong[i]} ${d.getDate()}` })}
              className={`${cellClass} hover:bg-gray-50 dark:hover:bg-gray-800`}
            >
              {label}
            </button>
          ) : (
            <div key={i} className={cellClass}>{label}</div>
          );
        })}
        <div className="flex items-center justify-center border-l border-gray-200 dark:border-gray-700/60">
          {onNext && (
            <button type="button" onClick={onNext} aria-label={t('calendar.nextWeek')} className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Time grid */}
      <div>
        <div className="relative grid" style={{ gridTemplateColumns: WEEK_COLUMNS, minHeight: `${HOURS * hourPx}px` }}>
          {/* Time labels */}
          <div>
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className="border-b border-gray-300 dark:border-gray-700/50 pr-2 text-right text-xs text-gray-500 dark:text-gray-400 pt-0.5"
                style={{ height: hourPx, lineHeight: '14px' }}
              >
                {`${String(HOUR_START + i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="contents">
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
                    if (drag.consumeClick()) return;
                    onSlotClick(`${dateStr}T${hhmm(slotUnderPointer(e.clientY, e.currentTarget, hourPx, HOUR_START, HOUR_END))}`);
                  } : undefined}
                  onMouseMove={onSlotClick ? (e) => {
                    if (drag.dragged || isOverSomething(e.target)) { setHover(null); return; }
                    setHover({ day: dateStr, minutes: slotUnderPointer(e.clientY, e.currentTarget, hourPx, HOUR_START, HOUR_END) });
                  } : undefined}
                  onMouseLeave={() => setHover(null)}
                  className={`relative flex-1 border-l border-gray-200 dark:border-gray-700/50 ${
                    isToday ? 'bg-primary-50/20 dark:bg-primary-900/10' : ''
                  } ${onSlotClick ? 'cursor-copy' : ''}`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-gray-300 dark:border-gray-700/50"
                      style={{ top: `${i * hourPx}px`, height: `${hourPx}px` }}
                    >
                      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200 dark:border-gray-700/30" />
                    </div>
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

                  {/* The slot a click would book */}
                  {hover?.day === dateStr && (
                    <SlotPreview minutes={hover.minutes} hourStart={HOUR_START} totalMinutes={totalMinutes} />
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
                          ...chipColors(color, isDark),
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
          {/* Under the next-week arrow: no lines, keeps the columns under their days */}
          <div className="border-l border-gray-200 dark:border-gray-700/60" />
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
