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

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function minutesSinceDayStart(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function layoutDay(appts: AppointmentResponse[]): Map<string, { col: number; cols: number }> {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  const layout = new Map<string, { col: number; cols: number }>();
  const clusters: AppointmentResponse[][] = [];

  for (const appt of sorted) {
    const apptStart = new Date(appt.startAt).getTime();
    let placed = false;
    for (const cluster of clusters) {
      const clusterEnd = Math.max(...cluster.map((a) => new Date(a.endAt).getTime()));
      if (apptStart < clusterEnd) {
        cluster.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([appt]);
  }

  for (const cluster of clusters) {
    const cols = cluster.length;
    cluster.forEach((appt, colIdx) => {
      layout.set(appt.id, { col: colIdx, cols });
    });
  }

  return layout;
}

export const HOUR_PX = 56;

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
