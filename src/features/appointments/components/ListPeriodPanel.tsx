import { useTranslation } from 'react-i18next';
import { toLocalIsoDate } from '@/shared/lib/dates';

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onDone: () => void;
}

const INPUT = 'w-full rounded-lg border border-control bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/** The period of the appointment list: a quick pick, or any two dates (user request 2026-11-12). */
export function ListPeriodPanel({ from, to, onChange, onDone }: Props) {
  const { t } = useTranslation('appointments');
  const now = new Date();
  const today = toLocalIsoDate(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const presets = [
    { label: t('preset.today'), from: today, to: today },
    { label: t('preset.thisWeek'), from: toLocalIsoDate(monday), to: toLocalIsoDate(sunday) },
    {
      label: t('preset.thisMonth'),
      from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    },
  ];

  return (
    <div className="w-64 space-y-3">
      <div className="flex flex-col gap-1">
        {presets.map((p) => {
          const on = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => { onChange(p.from, p.to); onDone(); }}
              className={`rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                on
                  ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {t('filter.from')}
          <input
            type="date"
            aria-label={t('filter.from')}
            value={from}
            max={to}
            onChange={(e) => e.target.value && onChange(e.target.value, e.target.value > to ? e.target.value : to)}
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {t('filter.to')}
          <input
            type="date"
            aria-label={t('filter.to')}
            value={to}
            min={from}
            onChange={(e) => e.target.value && onChange(e.target.value < from ? e.target.value : from, e.target.value)}
            className={`mt-1 ${INPUT}`}
          />
        </label>
      </div>
    </div>
  );
}
