import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppointmentResponse } from '../services/appointmentService';
import type { StaffBlockedTimeResponse } from '@/features/staff/services/staffService';
import { ABSENCE_EMOJI } from '@/features/staff/lib/absence';
import { useTheme } from '@/shared/context/ThemeContext';
import { HOUR_PX, SLOT_MINUTES, calendarHourRange, isoDate, layoutDay, minutesSinceDayStart, useNow } from './calendarGrid';
import { useCalendarDrag } from './useCalendarDrag';

export interface DayProvider {
  id: string;
  fullName: string;
  colorHex: string | null;
}

interface Props {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  providers: DayProvider[];
  appointments: AppointmentResponse[];
  absences: StaffBlockedTimeResponse[];
  patientNames: Record<string, string>;
  appointmentTypeNames: Record<string, string>;
  onAppointmentClick?: (appt: AppointmentResponse) => void;
  /** Click on empty time: local "YYYY-MM-DDTHH:mm" (half hour) and the doctor of that column. */
  onSlotClick?: (startAt: string, providerId: string) => void;
  /** Drop after a drag: new local start, and the new doctor when the column changed. */
  onMove?: (appt: AppointmentResponse, newStartAt: string, newProviderId?: string) => void;
}

const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** One day, one column per doctor: how the front desk plans the day. */
export function DayCalendar({ date, providers, appointments, absences, patientNames, appointmentTypeNames, onAppointmentClick, onSlotClick, onMove }: Props) {
  const { t } = useTranslation('appointments');
  const { t: ts } = useTranslation('staff');
  const { theme } = useTheme();
  const chipBgOpacity = theme === 'dark' ? '55' : '28';

  const now = useNow();
  const isToday = isoDate(now) === date;
  const nowHour = isToday ? now.getHours() : null;
  const { start: HOUR_START, end: HOUR_END } = useMemo(
    () => calendarHourRange(appointments, nowHour === null ? undefined : new Date(2000, 0, 1, nowHour)),
    [appointments, nowHour],
  );
  const HOURS = HOUR_END - HOUR_START;
  const totalMinutes = HOURS * 60;
  const pct = (minutesSinceGridStart: number) => (minutesSinceGridStart / totalMinutes) * 100;

  const drag = useCalendarDrag({ hourStart: HOUR_START, hourEnd: HOUR_END, onMove });

  const dayStart = new Date(`${date}T00:00:00`).getTime();
  const gridStart = dayStart + HOUR_START * 3_600_000;
  const gridEnd = dayStart + HOUR_END * 3_600_000;

  if (providers.length === 0) {
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('calendar.noProviders')}</p>;
  }

  const nowOffset = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const nowTopPct = isToday && nowOffset >= 0 && nowOffset < totalMinutes ? pct(nowOffset) : null;
  const columnsTemplate = `56px repeat(${providers.length}, minmax(11rem, 1fr))`;

  return (
    <div className="flex flex-col h-full overflow-x-auto overflow-y-hidden">
      {/* Doctor header */}
      <div className="grid border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" style={{ gridTemplateColumns: columnsTemplate }}>
        <div className="border-r border-gray-100 dark:border-gray-700/60" />
        {providers.map((p) => (
          <div key={p.id} className="flex items-center justify-center gap-2 px-2 py-2.5 border-r border-gray-100 dark:border-gray-700/60 last:border-r-0 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.colorHex ?? '#6366F1' }} />
            <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{p.fullName}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto flex-1 bg-white dark:bg-gray-900">
        <div className="relative grid" style={{ gridTemplateColumns: columnsTemplate, minHeight: `${HOURS * HOUR_PX}px` }}>
          <div>
            {Array.from({ length: HOURS }, (_, i) => (
              <div key={i} className="h-14 border-b border-gray-100 dark:border-gray-700/50 pr-2 text-right text-xs text-gray-500 dark:text-gray-400 pt-0.5" style={{ lineHeight: '14px' }}>
                {`${String(HOUR_START + i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {providers.map((p) => {
            const color = p.colorHex ?? '#6366F1';
            const visits = appointments.filter((a) => a.providerId === p.id);
            const layout = layoutDay(visits);
            const away = absences.filter((b) => b.staffMemberId === p.id);
            const ghost = drag.preview && drag.dragged && drag.preview.day === date && drag.preview.providerId === p.id ? drag.preview : null;

            return (
              <div
                key={p.id}
                data-drop-day={date}
                data-provider-id={p.id}
                onClick={onSlotClick ? (e) => {
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  const slot = Math.floor((y / HOUR_PX) * (60 / SLOT_MINUTES));
                  const minutes = Math.min(Math.max(HOUR_START * 60 + slot * SLOT_MINUTES, HOUR_START * 60), HOUR_END * 60 - SLOT_MINUTES);
                  onSlotClick(`${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, p.id);
                } : undefined}
                className={`relative border-l border-gray-100 dark:border-gray-700/50 ${onSlotClick ? 'cursor-copy hover:bg-gray-50/60 dark:hover:bg-gray-800/40' : ''}`}
              >
                {Array.from({ length: HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-b border-gray-100 dark:border-gray-700/50" style={{ top: `${i * HOUR_PX}px`, height: `${HOUR_PX}px` }} />
                ))}

                {/* Absence: striped, and not bookable */}
                {away.map((b) => {
                  const from = Math.max(new Date(b.startAt).getTime(), gridStart);
                  const to = Math.min(new Date(b.endAt).getTime(), gridEnd);
                  if (to <= from) return null;
                  const type = b.absenceType ?? '';
                  return (
                    <div
                      key={b.id}
                      data-testid="absence"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-x-0 z-[5] flex items-start justify-center cursor-not-allowed bg-[repeating-linear-gradient(135deg,var(--color-gray-100)_0_8px,transparent_8px_16px)] dark:bg-[repeating-linear-gradient(135deg,var(--color-gray-800)_0_8px,transparent_8px_16px)]"
                      style={{ top: `${pct((from - gridStart) / 60_000)}%`, height: `${pct((to - from) / 60_000)}%` }}
                    >
                      <span className="mt-2 rounded-full bg-white/90 dark:bg-gray-900/90 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm">
                        <span aria-hidden>{ABSENCE_EMOJI[type] ?? '📅'} </span>
                        {ts(`absence.type.${type}`, { defaultValue: type })}
                      </span>
                    </div>
                  );
                })}

                {isToday && nowTopPct !== null && (
                  <div
                    data-testid="now-line"
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-red-500 dark:bg-red-400"
                    style={{ top: `${nowTopPct}%` }}
                  >
                    {p.id === providers[0].id && <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-500 dark:bg-red-400" />}
                  </div>
                )}

                {/* Where a dragged visit would land */}
                {ghost && drag.dragged && (
                  <div
                    data-testid="drop-preview"
                    className="pointer-events-none absolute inset-x-1 z-30 rounded border-2 border-dashed border-primary-500 bg-primary-50/70 dark:bg-primary-900/40 px-1.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-200"
                    style={{ top: `${pct(ghost.startMinutes - HOUR_START * 60)}%`, height: `${pct(drag.dragged.durationMinutes)}%` }}
                  >
                    {`${String(Math.floor(ghost.startMinutes / 60)).padStart(2, '0')}:${String(ghost.startMinutes % 60).padStart(2, '0')}`}
                  </div>
                )}

                {visits.map((appt) => {
                  const offset = minutesSinceDayStart(appt.startAt) - HOUR_START * 60;
                  if (offset < 0 || offset >= totalMinutes) return null;
                  const { col, cols } = layout.get(appt.id) ?? { col: 0, cols: 1 };
                  const widthPct = 100 / cols;
                  const label = [patientNames[appt.patientId], appointmentTypeNames[appt.appointmentTypeId]].filter(Boolean).join(' · ');
                  const chip = drag.chipProps(appt);
                  return (
                    <button
                      key={appt.id}
                      onPointerDown={chip.onPointerDown}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (drag.consumeClick()) return;
                        onAppointmentClick?.(appt);
                      }}
                      className={`absolute z-10 overflow-hidden rounded text-left text-xs px-1.5 py-0.5 shadow-sm hover:brightness-110 transition select-none ${drag.dragged?.id === appt.id ? 'opacity-40' : ''}`}
                      style={{
                        top: `${pct(offset)}%`,
                        height: `${Math.max(pct(appt.durationMinutes), 1.5)}%`,
                        left: `calc(${col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: color + chipBgOpacity,
                        borderLeft: `3px solid ${color}`,
                        ...chip.style,
                      }}
                    >
                      <span className="font-semibold truncate block" style={{ color }}>
                        {fmtTime(new Date(appt.startAt))} – {fmtTime(new Date(appt.endAt))}
                      </span>
                      <span className="truncate block text-gray-700 dark:text-gray-300">{label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
