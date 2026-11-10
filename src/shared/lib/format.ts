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

// Bosnian by hand: browsers often lack bs data, and the hr fallback wrote Croatian months
// ("studenoga", "lis") and weekdays. Months with a day take the genitive: "3. novembra".
const BS_WEEKDAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota']
const BS_WEEKDAYS_SHORT = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub']
const BS_MONTHS = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra']
const BS_MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export interface DayMonthOptions {
  weekday?: 'long' | 'short'
  month: 'long' | 'short'
  year?: boolean
  time?: boolean
}

/** A day with its month written out, in the UI language: "utorak, 3. novembra 2026.", "sub, 31. okt, 01:00". */
export function formatDayMonth(value: string | Date, opts: DayMonthOptions, lang: string = i18n.language): string {
  const d = toDate(value)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (lang.startsWith('bs')) {
    const weekday = opts.weekday ? `${(opts.weekday === 'long' ? BS_WEEKDAYS : BS_WEEKDAYS_SHORT)[d.getDay()]}, ` : ''
    const month = (opts.month === 'long' ? BS_MONTHS : BS_MONTHS_SHORT)[d.getMonth()]
    const year = opts.year ? ` ${d.getFullYear()}.` : ''
    return `${weekday}${d.getDate()}. ${month}${year}${opts.time ? `, ${time}` : ''}`
  }
  const text = d.toLocaleDateString(lang.startsWith('de') ? 'de-DE' : 'en-GB', {
    weekday: opts.weekday, month: opts.month, day: 'numeric', year: opts.year ? 'numeric' : undefined,
  })
  return opts.time ? `${text}, ${time}` : text
}

const BS_MONTHS_NOMINATIVE = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']

/** A month and its year, as a title: "Novembar 2026", "November 2026". */
export function formatMonthYear(value: string | Date, lang: string = i18n.language): string {
  const d = toDate(value)
  if (lang.startsWith('bs')) return `${BS_MONTHS_NOMINATIVE[d.getMonth()]} ${d.getFullYear()}`
  return d.toLocaleDateString(lang.startsWith('de') ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' })
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
