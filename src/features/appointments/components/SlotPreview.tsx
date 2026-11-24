import { SLOT_MINUTES } from './calendarGrid';

/** "10:30" from minutes since midnight. */
export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The slot start (minutes since midnight) under a pointer at `clientY` in a day column:
 * rounded down to the half hour and kept inside the grid. Clicking books exactly this.
 */
export function slotUnderPointer(clientY: number, column: HTMLElement, hourPx: number, hourStart: number, hourEnd: number) {
  const y = clientY - column.getBoundingClientRect().top;
  const slot = Math.floor((y / hourPx) * (60 / SLOT_MINUTES));
  return Math.min(Math.max(hourStart * 60 + slot * SLOT_MINUTES, hourStart * 60), hourEnd * 60 - SLOT_MINUTES);
}

/** Over a visit, an absence or a button the pointer is not on free time. */
export function isOverSomething(target: EventTarget) {
  return !!(target as HTMLElement).closest?.('button, [data-testid="absence"]');
}

/**
 * The slot a click would book, under the mouse (user request 2026-11-10): a tinted box with
 * its start time, the size of one slot. Purely visual; the column handles the click.
 */
export function SlotPreview({ minutes, hourStart, totalMinutes }: { minutes: number; hourStart: number; totalMinutes: number }) {
  return (
    <div
      data-testid="slot-preview"
      aria-hidden
      className="pointer-events-none absolute inset-x-1 z-10 flex items-start rounded-md border border-primary-400 bg-primary-50 px-1.5 py-0.5 text-xs font-semibold text-primary-700 dark:border-primary-400/60 dark:bg-primary-500/20 dark:text-primary-200"
      style={{
        top: `${((minutes - hourStart * 60) / totalMinutes) * 100}%`,
        height: `${(SLOT_MINUTES / totalMinutes) * 100}%`,
      }}
    >
      + {hhmm(minutes)}
    </div>
  );
}

/**
 * The strip at the top or bottom of a visit that changes when it starts or ends
 * (user request 2026-11-10). A short bar shows on hover so it can be found.
 */
export function ResizeHandle({ edge, onPointerDown }: { edge: 'top' | 'bottom'; onPointerDown: (e: React.PointerEvent<HTMLElement>) => void }) {
  return (
    <span
      data-testid="resize-handle"
      data-edge={edge}
      aria-hidden
      onPointerDown={onPointerDown}
      className={`absolute inset-x-0 z-10 flex h-2 cursor-ns-resize justify-center ${edge === 'top' ? 'top-0 items-start pt-px' : 'bottom-0 items-end pb-px'}`}
    >
      <span className="h-0.5 w-6 rounded-full bg-gray-500/60 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-300/60" />
    </span>
  );
}
