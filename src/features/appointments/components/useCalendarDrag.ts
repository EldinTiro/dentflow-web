import { useEffect, useRef, useState } from 'react';
import type { AppointmentResponse } from '../services/appointmentService';

/** Visits snap to quarter hours when dropped. */
const SNAP_MINUTES = 15;
/** Less movement than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

/** The API moves only these (AppointmentStatus.CanReschedule). */
const MOVABLE = new Set(['Scheduled', 'CheckedIn']);

export interface DropTarget {
  day: string;               // YYYY-MM-DD of the column
  providerId?: string;       // set on day-view columns, one per doctor
  startMinutes: number;      // minutes since midnight, snapped
}

interface Grab {
  appt: AppointmentResponse;
  x: number;
  y: number;
  offsetPx: number;          // where on the chip it was grabbed, so the top doesn't jump
  dragging: boolean;
  /** Set when the bottom edge was grabbed: the column the visit sits in. */
  resizeColumn?: HTMLElement;
}

/** "YYYY-MM-DD" and minutes since midnight of a visit's local start. */
function localStart(appt: AppointmentResponse) {
  const d = new Date(appt.startAt);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { day, minutes: d.getHours() * 60 + d.getMinutes() };
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Drag a visit chip to another time (and, in the day view, another doctor's column),
 * or pull its bottom edge to change how long it lasts.
 * Columns mark themselves with `data-drop-day` (and `data-provider-id`).
 */
export function useCalendarDrag({ hourStart, hourEnd, hourPx, onMove, onResize }: {
  hourStart: number;
  hourEnd: number;
  /** Height of an hour on the grid, which follows the space the calendar has. */
  hourPx: number;
  onMove?: (appt: AppointmentResponse, newStartAt: string, newProviderId?: string) => void;
  /** The bottom edge was let go: the new local end ("YYYY-MM-DDTHH:mm"); the start stays. */
  onResize?: (appt: AppointmentResponse, newEndAt: string) => void;
}) {
  const grab = useRef<Grab | null>(null);
  const justDragged = useRef(false);
  const [dragged, setDragged] = useState<AppointmentResponse | null>(null);
  const [preview, setPreview] = useState<DropTarget | null>(null);
  const [resized, setResized] = useState<{ id: string; endMinutes: number } | null>(null);
  const latest = useRef({ hourStart, hourEnd, hourPx, onMove, onResize });
  latest.current = { hourStart, hourEnd, hourPx, onMove, onResize };

  /** The end under the pointer: snapped, at least one snap after the start, inside the grid. */
  function endAt(y: number, g: Grab) {
    const { hourStart: hs, hourEnd: he, hourPx } = latest.current;
    const raw = hs * 60 + ((y - g.resizeColumn!.getBoundingClientRect().top) / hourPx) * 60;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.min(Math.max(snapped, localStart(g.appt).minutes + SNAP_MINUTES), he * 60);
  }

  function targetAt(x: number, y: number, g: Grab): DropTarget | null {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-day]');
    if (!column) return null;
    const { hourStart: hs, hourEnd: he, hourPx } = latest.current;
    const top = column.getBoundingClientRect().top;
    const raw = hs * 60 + ((y - top - g.offsetPx) / hourPx) * 60;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    const startMinutes = Math.min(Math.max(snapped, hs * 60), he * 60 - g.appt.durationMinutes);
    return { day: column.dataset.dropDay!, providerId: column.dataset.providerId, startMinutes };
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const g = grab.current;
      if (!g) return;
      if (!g.dragging && Math.hypot(e.clientX - g.x, e.clientY - g.y) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      if (g.resizeColumn) {
        setResized({ id: g.appt.id, endMinutes: endAt(e.clientY, g) });
        return;
      }
      setDragged(g.appt);
      setPreview(targetAt(e.clientX, e.clientY, g));
    }
    function up(e: PointerEvent) {
      const g = grab.current;
      grab.current = null;
      if (!g?.dragging) return;
      justDragged.current = true;
      // The click the browser sends right after this pointerup lands on the chip or on the
      // column it was dropped in; any later click is a real one again
      setTimeout(() => { justDragged.current = false; }, 0);
      if (g.resizeColumn) {
        setResized(null);
        const start = localStart(g.appt);
        const end = endAt(e.clientY, g);
        if (end !== start.minutes + g.appt.durationMinutes) latest.current.onResize?.(g.appt, `${start.day}T${hhmm(end)}`);
        return;
      }
      setDragged(null);
      setPreview(null);
      const target = targetAt(e.clientX, e.clientY, g);
      if (!target) return;
      const hh = String(Math.floor(target.startMinutes / 60)).padStart(2, '0');
      const mm = String(target.startMinutes % 60).padStart(2, '0');
      const startAt = `${target.day}T${hh}:${mm}`;
      const old = new Date(g.appt.startAt);
      const sameTime = target.day === `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`
        && target.startMinutes === old.getHours() * 60 + old.getMinutes();
      const sameDoctor = !target.providerId || target.providerId === g.appt.providerId;
      if (sameTime && sameDoctor) return;
      latest.current.onMove?.(g.appt, startAt, target.providerId && !sameDoctor ? target.providerId : undefined);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return {
    /** The visit being dragged, to dim its chip. */
    dragged,
    /** Where it would land right now. */
    preview,
    /** How long a visit is drawn: its new length while its edge is being pulled. */
    durationOf(appt: AppointmentResponse) {
      return resized?.id === appt.id ? resized.endMinutes - localStart(appt).minutes : appt.durationMinutes;
    },
    /** Spread on the strip at the bottom of a chip; null when the visit can't be changed. */
    resizeProps(appt: AppointmentResponse) {
      if (!onResize || !MOVABLE.has(appt.status)) return null;
      return {
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          if (e.button !== 0) return;
          e.stopPropagation(); // not a move
          const resizeColumn = e.currentTarget.closest<HTMLElement>('[data-drop-day]') ?? undefined;
          if (!resizeColumn) return;
          grab.current = { appt, x: e.clientX, y: e.clientY, offsetPx: 0, dragging: false, resizeColumn };
        },
      };
    },
    /** Spread on a chip. */
    chipProps(appt: AppointmentResponse) {
      const movable = !!onMove && MOVABLE.has(appt.status);
      return {
        onPointerDown: movable
          ? (e: React.PointerEvent<HTMLElement>) => {
              if (e.button !== 0) return;
              grab.current = { appt, x: e.clientX, y: e.clientY, offsetPx: e.clientY - e.currentTarget.getBoundingClientRect().top, dragging: false };
            }
          : undefined,
        style: movable ? { touchAction: 'none' as const, cursor: dragged?.id === appt.id ? 'grabbing' : 'grab' } : undefined,
      };
    },
    /** True once right after a drop: the click that follows must not open the visit or book the slot. */
    consumeClick() {
      const was = justDragged.current;
      justDragged.current = false;
      return was;
    },
  };
}
