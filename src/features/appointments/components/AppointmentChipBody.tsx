/** Below this a chip has room for one line only (56px an hour → ~42px). */
const ONE_LINE_BELOW_MINUTES = 45

/**
 * The doctor's colour, made readable as text: a pale colour (yellow) on its own pale tint
 * could hardly be read, so it is darkened on light backgrounds and lightened on dark ones.
 */
export function chipTextColor(color: string, dark: boolean): string {
  return dark ? `color-mix(in srgb, ${color} 70%, white)` : `color-mix(in srgb, ${color} 55%, black)`
}

/**
 * The chip's colours. Light theme (user request 2026-11-10: the calendar looked washed out):
 * a stronger tint, a thin outline in the doctor's colour and a 4px edge, so a visit stands
 * out from the white grid. The dark theme keeps its look.
 */
export function chipColors(color: string, dark: boolean) {
  return dark
    ? { backgroundColor: color + '55', borderLeft: `3px solid ${color}` }
    : { backgroundColor: color + '3D', border: `1px solid ${color}66`, borderLeft: `4px solid ${color}` }
}

/** Class for the chip itself: content starts top-left (a <button> centres it vertically). */
export const CHIP_LAYOUT = 'flex flex-col items-stretch justify-start text-left'

/** What a visit chip says: time and name, on one line when the visit is short. */
export function AppointmentChipBody({ time, label, color, durationMinutes, dark }: {
  time: string
  label: string
  color: string
  durationMinutes: number
  dark: boolean
}) {
  const timeStyle = { color: chipTextColor(color, dark) }
  if (durationMinutes < ONE_LINE_BELOW_MINUTES) {
    return (
      <span data-layout="one-line" className="block truncate leading-tight">
        <span className="font-semibold tabular-nums" style={timeStyle}>{time}</span>{' '}
        <span className="text-gray-900 dark:text-gray-200">{label}</span>
      </span>
    )
  }
  return (
    <span data-layout="two-lines" className="block leading-tight">
      <span className="block truncate font-semibold tabular-nums" style={timeStyle}>{time}</span>
      <span className="block truncate text-gray-900 dark:text-gray-200">{label}</span>
    </span>
  )
}
