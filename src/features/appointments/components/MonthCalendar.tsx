import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppointmentResponse } from '../services/appointmentService';
import { formatDayMonth } from '@/shared/lib/format';
import { isoDate } from './calendarGrid';
import { monthWeeks } from './MiniMonth';

interface Props {
  year: number;
  /** 0-based, like Date. */
  month: number;
  /** Visits to count: cancelled and no-show already left out. */
  appointments: AppointmentResponse[];
  providerColors: Record<string, string>;
  providerNames: Record<string, string>;
  /** Weekdays (0 = Monday) left out: the clinic is closed then and nothing is booked. */
  hiddenWeekdays?: number[];
  onDayClick?: (date: string) => void;
}

/** Doctors shown by name in a day; the rest are summed up as "+N". */
const MAX_DOCTORS = 3;

/**
 * A month at a glance (user request 2026-11-10): per day, how many visits and with which
 * doctors. A busy clinic has 20–30 a day, so a day shows counts, not the visits themselves;
 * a click opens the day.
 */
export function MonthCalendar({ year, month, appointments, providerColors, providerNames, hiddenWeekdays = [], onDayClick }: Props) {
  const { t, i18n } = useTranslation('appointments');
  const weekdaysLong = t('calendar.weekdaysLong', { returnObjects: true }) as string[];
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];
  const shownWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((i) => !hiddenWeekdays.includes(i));
  const columns = `repeat(${shownWeekdays.length}, minmax(0, 1fr))`;
  const weeks = monthWeeks(year, month);
  const today = isoDate(new Date());

  // date → doctor → count
  const byDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const a of appointments) {
      const key = isoDate(new Date(a.startAt));
      const doctors = map.get(key) ?? new Map<string, number>();
      doctors.set(a.providerId, (doctors.get(a.providerId) ?? 0) + 1);
      map.set(key, doctors);
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex h-full flex-col overflow-auto bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 grid border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" style={{ gridTemplateColumns: columns, height: 48 }}>
        {shownWeekdays.map((i) => (
          <div key={i} className="flex items-center justify-center border-l first:border-l-0 border-gray-200 text-xs font-medium text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            <span className="sm:hidden">{weekdays[i]}</span><span className="hidden sm:inline">{weekdaysLong[i]}</span>
          </div>
        ))}
      </div>

      <div className="grid flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(6.5rem, 1fr))` }}>
        {weeks.map((week) => (
          <div key={isoDate(week[0])} className="grid border-b border-gray-200 dark:border-gray-700/60" style={{ gridTemplateColumns: columns }}>
            {shownWeekdays.map((i) => {
              const d = week[i];
              const iso = isoDate(d);
              const inMonth = d.getMonth() === month;
              const doctors = [...(byDay.get(iso) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
              const total = doctors.reduce((n, [, c]) => n + c, 0);
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onDayClick?.(iso)}
                  aria-label={`${formatDayMonth(d, { month: 'long', year: true }, i18n.language)}, ${t('calendar.visitCount', { count: total })}`}
                  className={`flex min-w-0 flex-col items-stretch gap-1 border-l first:border-l-0 border-gray-200 p-1.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-700/60 dark:hover:bg-gray-800 ${
                    inMonth ? '' : 'bg-gray-50/70 dark:bg-gray-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums ${
                      isToday ? 'bg-primary-600 font-semibold text-white' : inMonth ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {d.getDate()}
                    </span>
                    {total > 0 && (
                      <span aria-hidden className="rounded-full bg-primary-50 px-1.5 text-xs font-semibold tabular-nums text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
                        {total}
                      </span>
                    )}
                  </div>
                  <div aria-hidden className="flex min-w-0 flex-col gap-0.5">
                    {doctors.slice(0, MAX_DOCTORS).map(([id, count]) => (
                      <span key={id} title={`${providerNames[id] ?? ''}: ${count}`} className="flex min-w-0 items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: providerColors[id] ?? '#6366F1' }} />
                        <span className="truncate">{providerNames[id] ?? ''}</span>
                        <span className="ml-auto tabular-nums font-medium">{count}</span>
                      </span>
                    ))}
                    {doctors.length > MAX_DOCTORS && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">+{doctors.length - MAX_DOCTORS}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
