import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { MiniMonth } from './MiniMonth';

const ARROW = 'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

interface Props {
  label: string;
  selected?: string;
  onPick?: (date: string) => void;
  /** Something else to choose from instead of the month (the list picks a range). */
  panel?: (close: () => void) => ReactNode;
  panelLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}

/**
 * Previous / next and the period shown, as a button that opens a small month to jump to a
 * date (user requests 2026-11-10: the arrows moved here from the calendar, for more room).
 * The month closes on a pick, on Escape and on a click elsewhere.
 */
export function PeriodPicker({ label, selected = '', onPick, onPrev, onNext, prevLabel, nextLabel, panel, panelLabel }: Props) {
  const { t } = useTranslation('appointments');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [open]);

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={ARROW}>
        <ChevronLeft size={16} strokeWidth={2.5} aria-hidden />
      </button>
      <button type="button" onClick={onNext} aria-label={nextLabel} className={ARROW}>
        <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
      </button>
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-800 tabular-nums hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <CalendarDays size={15} className="text-gray-500 dark:text-gray-400" aria-hidden />
        {label}
        <ChevronDown size={14} className={`text-gray-500 transition-transform dark:text-gray-400 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={panelLabel ?? t('calendar.pickDate')}
          className="absolute left-0 top-full z-40 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {panel ? panel(() => setOpen(false)) : <MiniMonth selected={selected} onPick={(d) => { setOpen(false); onPick?.(d); }} />}
        </div>
      )}
    </div>
    </div>
  );
}
