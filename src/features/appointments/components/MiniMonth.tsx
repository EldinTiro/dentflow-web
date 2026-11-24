import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDayMonth, formatMonthYear } from '@/shared/lib/format';
import { isoDate } from './calendarGrid';

/**
 * The weeks (Monday first) that cover a month, from the Monday on or before the 1st to the
 * Sunday on or after its last day. `month` is 0-based, like Date.
 */
export function monthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const weeks: Date[][] = [];
  for (let d = start; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
  }
  return weeks;
}

/**
 * A small month to pick a date from (user request 2026-11-10). Opens on the month of
 * `selected`; the arrows page months without picking anything.
 */
export function MiniMonth({ selected, onPick }: { selected: string; onPick: (date: string) => void }) {
  const { t, i18n } = useTranslation('appointments');
  const [shown, setShown] = useState(() => {
    const d = new Date(`${selected}T12:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const page = (n: number) => setShown(({ year, month }) => {
    const d = new Date(year, month + n, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const today = isoDate(new Date());
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];

  return (
    <div className="w-64 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => page(-1)} aria-label={t('calendar.prevMonth')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {formatMonthYear(new Date(shown.year, shown.month, 1), i18n.language)}
        </span>
        <button type="button" onClick={() => page(1)} aria-label={t('calendar.nextMonth')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((w) => (
          <div key={w} className="py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{w}</div>
        ))}
        {monthWeeks(shown.year, shown.month).flat().map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === shown.month;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              aria-pressed={isSelected}
              aria-label={formatDayMonth(d, { month: 'long', year: true }, i18n.language)}
              className={`h-8 rounded-md text-sm tabular-nums transition-colors ${
                isSelected
                  ? 'bg-primary-600 font-semibold text-white'
                  : `${inMonth ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'} hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    iso === today ? 'font-semibold ring-1 ring-inset ring-primary-500' : ''}`
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
