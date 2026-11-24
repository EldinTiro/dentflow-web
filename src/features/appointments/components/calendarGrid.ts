import { useEffect, useState } from 'react';
import type { AppointmentResponse } from '../services/appointmentService';

/** Shared by the week and the day calendar: hours shown, chip layout, "now". */

export const DEFAULT_HOUR_START = 6;  // 06:00
export const DEFAULT_HOUR_END   = 21; // 21:00

/**
 * Hours the grid shows: the clinic's opening hours when known, else 06:00–21:00,
 * stretched to fit anything booked earlier or later. A fixed 06:00 start hid a 00:30
 * booking entirely (QA-029). Without opening hours, pass `now` on the current week so
 * the current-time line always has a place; with them, the grid stays on working hours
 * and the line shows only while the clinic is open.
 */
export function calendarHourRange(
  appointments: { startAt: string; endAt: string }[],
  now?: Date,
  open?: { start: number; end: number } | null,
) {
  let start = open?.start ?? DEFAULT_HOUR_START;
  let end = open?.end ?? DEFAULT_HOUR_END;
  if (now && !open) {
    start = Math.min(start, now.getHours());
    end = Math.max(end, now.getHours() + 1);
  }
  for (const a of appointments) {
    start = Math.min(start, new Date(a.startAt).getHours());
    const e = new Date(a.endAt);
    end = Math.max(end, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
  }
  return { start, end: Math.min(end, 24) };
}

/**
 * The visits the calendar draws: not cancelled ones, which free their slot (client report
 * 2026-11-10). A no-show stays, drawn as missed, so the desk sees who did not come
 * (user request 2026-11-11). The list and the patient's history show them all.
 */
export function onCalendar<T extends { status: string }>(appointments: T[]): T[] {
  return appointments.filter((a) => a.status !== 'Cancelled');
}

/** A no-show is drawn grey and faded, whatever the doctor's colour. */
export const MISSED_COLOR = '#9CA3AF';

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function minutesSinceDayStart(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function layoutDay(appts: AppointmentResponse[]): Map<string, { col: number; cols: number }> {
  const t = (iso: string) => new Date(iso).getTime();
  // By start; of two that start together the longer goes left
  const sorted = [...appts].sort(
    (a, b) => t(a.startAt) - t(b.startAt) || t(b.endAt) - t(a.endAt),
  );

  const layout = new Map<string, { col: number; cols: number }>();
  // A cluster is a run of visits that overlap one another, directly or through a neighbour.
  // Inside it each visit takes the first column that is free by its start, so back-to-back
  // visits share a column instead of each getting their own (user report 2026-11-10).
  let cluster: AppointmentResponse[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;
  const colOf = new Map<string, number>();

  const close = () => {
    for (const appt of cluster) layout.set(appt.id, { col: colOf.get(appt.id)!, cols: columnEnds.length });
    cluster = [];
    columnEnds = [];
  };

  for (const appt of sorted) {
    const start = t(appt.startAt);
    const finish = t(appt.endAt);
    if (start >= clusterEnd) close();
    let col = columnEnds.findIndex((end) => end <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(finish);
    } else {
      columnEnds[col] = finish;
    }
    colOf.set(appt.id, col);
    cluster.push(appt);
    clusterEnd = Math.max(clusterEnd, finish);
  }
  close();

  return layout;
}

/**
 * An hour is at least this tall, so 15 minutes (20px) still holds a line of text. When there
 * is more room the hours grow to fill it; when there is less, the grid scrolls.
 */
export const MIN_HOUR_PX = 80;

/** Height of one hour for a grid of `hours` in `available` pixels. */
export function hourHeightFor(available: number, hours: number): number {
  return Math.max(MIN_HOUR_PX, Math.floor(available / Math.max(hours, 1)));
}

/**
 * Hour height that fills an element's height (less `reservedPx`, e.g. a sticky header inside
 * it), following it as the window resizes. Returns a callback ref: the grid may mount later
 * than the calendar (e.g. once the doctors load), and measuring has to start when it does.
 */
export function useHourHeight(hours: number, reservedPx = 0): [(el: HTMLElement | null) => void, number] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, hourHeightFor(available - reservedPx, hours)];
}

/** The current time, refreshed every minute so the now-line keeps moving. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const SLOT_MINUTES = 30;
