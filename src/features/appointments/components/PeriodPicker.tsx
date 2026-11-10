import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { MiniMonth } from './MiniMonth';

/**
 * The period under the page title, as a button that opens a small month to jump to a date
 * (user request 2026-11-10). Closes on a pick, on Escape and on a click elsewhere.
 */
export function PeriodPicker({ label, selected, onPick }: { label: string; selected: string; onPick: (date: string) => void }) {
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
    <div ref={box} className="relative mt-0.5 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-gray-600 tabular-nums hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={t('calendar.pickDate')}
          className="absolute left-0 top-full z-40 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <MiniMonth selected={selected} onPick={(d) => { setOpen(false); onPick(d); }} />
        </div>
      )}
    </div>
  );
}
