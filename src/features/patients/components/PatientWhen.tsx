import { useTranslation } from 'react-i18next'
import { formatDayMonth } from '@/shared/lib/format'
import { relativeDay } from '../lib/patientDisplay'

/** "Today 10:30", "Tomorrow 09:00", or "12 Nov 13:00" — in the app's language. */
export function useWhen() {
  const { t } = useTranslation('patients')
  return (iso: string, withTime = true) => {
    const d = new Date(iso)
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const rel = relativeDay(d)
    if (rel) return withTime ? t(`when.${rel}`, { time }) : t(`when.${rel}Day`)
    return formatDayMonth(d, { month: 'short', time: withTime })
  }
}
