import i18n from 'i18next'

/**
 * Display formatting driven by the UI language, not the browser default — the
 * latter gave US "10/22/2026" in a BiH clinic (QA-032). Built by hand where locale
 * data is unreliable: browsers without bs-BA rendered "2026 M11 2".
 */

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: string | Date): Date {
  // A bare calendar date must stay that date in any time zone.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`)
  return typeof value === 'string' ? new Date(value) : value
}

export function formatDate(value: string | Date | null | undefined, lang: string = i18n.language): string {
  if (!value) return '—'
  const d = toDate(value)
  const day = d.getDate(), month = d.getMonth() + 1, year = d.getFullYear()
  if (lang.startsWith('bs')) return `${day}. ${month}. ${year}.`
  if (lang.startsWith('de')) return `${pad(day)}.${pad(month)}.${year}`
  return `${pad(day)}/${pad(month)}/${year}`
}

export function formatDateTime(value: string | Date | null | undefined, lang: string = i18n.language): string {
  if (!value) return '—'
  const d = toDate(value)
  return `${formatDate(d, lang)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "08:00:00" → "08:00". */
export function formatTime(value: string): string {
  return value.slice(0, 5)
}

export const CURRENCY = 'KM'

export function formatMoney(amount: number, lang: string = i18n.language): string {
  const locale = lang.startsWith('en') ? 'en-US' : 'de-DE' // de-DE groups and separates like bs
  const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${n} ${CURRENCY}`
}
