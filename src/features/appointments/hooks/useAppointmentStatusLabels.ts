import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ALL_STATUSES, type AppointmentStatus } from '../services/appointmentService'

/** Appointment status labels in the selected language. */
export function useAppointmentStatusLabels(): Record<AppointmentStatus, string> {
  const { t, i18n } = useTranslation('appointments')
  return useMemo(
    () => Object.fromEntries(ALL_STATUSES.map((s) => [s, t(`statuses.${s}`)])) as Record<AppointmentStatus, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relabel when the language changes
    [t, i18n.language],
  )
}
