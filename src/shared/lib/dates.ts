/**
 * Calendar dates the user picks are local; the API stores UTC instants. Mixing the
 * two — e.g. `toISOString().slice(0, 10)` for "today" — is off by a day for the
 * first hours after local midnight (QA-008, QA-009). Go through these helpers.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date of an instant, as `YYYY-MM-DD`. */
export function toLocalIsoDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's local calendar date, as `YYYY-MM-DD`. */
export function todayLocal(now: Date = new Date()): string {
  return toLocalIsoDate(now)
}

/**
 * Turns a picked calendar date into an instant for "when did this happen" fields:
 * now if it is today (so it is never in the future), local noon otherwise.
 */
export function localDateToInstant(date: string, now: Date = new Date()): string {
  if (date === todayLocal(now)) return now.toISOString()
  return new Date(`${date}T12:00:00`).toISOString()
}

/** UTC instant at which the given local calendar day starts. */
export function localDayStartUtc(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString()
}

/** UTC instant at which the given local calendar day ends (inclusive). */
export function localDayEndUtc(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString()
}
