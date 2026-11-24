export interface FilterChip<T extends string> {
  value: T;
  label: string;
  /** Shown after the label, e.g. how many rows the filter leaves. */
  count?: number;
}

interface Props<T extends string> {
  label: string;
  options: FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Shared by every list page for the same look (user request 2026-11-12). */
export const CHIP_ON = 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/60 dark:bg-primary-500/20 dark:text-primary-200';
export const CHIP_OFF = 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';
export const CHIP = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors';

/**
 * One filter as a row of buttons, one of them on: the list pages filter this way, with no
 * drop-downs (user request 2026-11-12).
 */
export function FilterChips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value || 'all'}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`tabular-nums ${on ? '' : 'text-gray-400 dark:text-gray-500'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
