import { useEffect, useRef, useState } from 'react';
import type { AppointmentResponse } from '../services/appointmentService';
import { HOUR_PX } from './calendarGrid';

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
}

/**
 * Drag a visit chip to another time (and, in the day view, another doctor's column).
 * Columns mark themselves with `data-drop-day` (and `data-provider-id`).
 */
export function useCalendarDrag({ hourStart, hourEnd, onMove }: {
  hourStart: number;
  hourEnd: number;
  onMove?: (appt: AppointmentResponse, newStartAt: string, newProviderId?: string) => void;
}) {
  const grab = useRef<Grab | null>(null);
  const justDragged = useRef(false);
  const [dragged, setDragged] = useState<AppointmentResponse | null>(null);
  const [preview, setPreview] = useState<DropTarget | null>(null);
  const latest = useRef({ hourStart, hourEnd, onMove });
  latest.current = { hourStart, hourEnd, onMove };

  function targetAt(x: number, y: number, g: Grab): DropTarget | null {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-day]');
    if (!column) return null;
    const { hourStart: hs, hourEnd: he } = latest.current;
    const top = column.getBoundingClientRect().top;
    const raw = hs * 60 + ((y - top - g.offsetPx) / HOUR_PX) * 60;
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
      setDragged(g.appt);
      setPreview(targetAt(e.clientX, e.clientY, g));
    }
    function up(e: PointerEvent) {
      const g = grab.current;
      grab.current = null;
      if (!g?.dragging) return;
      justDragged.current = true;
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
    /** True once right after a drop: the click that follows must not open the visit. */
    consumeClick() {
      const was = justDragged.current;
      justDragged.current = false;
      return was;
    },
  };
}
