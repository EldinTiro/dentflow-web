import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, FileText, Receipt, Stethoscope, Wallet, type LucideIcon } from 'lucide-react'
import { ToothIcon } from '@/shared/components/ToothIcon'
import { useAppointmentStatusLabels } from '@/features/appointments/hooks/useAppointmentStatusLabels'
import type { AppointmentStatus } from '@/features/appointments/services/appointmentService'
import { formatMoney } from '@/shared/lib/format'
import { patientService, type TimelineEntry, type TimelineKind } from '../services/patientService'
import { useWhen } from './PatientWhen'

const ICONS: Record<TimelineKind, { icon: LucideIcon | typeof ToothIcon; tint: string }> = {
  appointment: { icon: CalendarDays, tint: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200' },
  treatment: { icon: Stethoscope, tint: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300' },
  invoice: { icon: Receipt, tint: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300' },
  payment: { icon: Wallet, tint: 'bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300' },
  document: { icon: FileText, tint: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300' },
  finding: { icon: ToothIcon, tint: 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300' },
}

/** Everything that happened to the patient, newest first (patients redesign C). */
export function PatientTimeline({ patientId }: { patientId: string }) {
  const { t } = useTranslation('patients')
  const tb = useTranslation('billing').t
  const statusLabels = useAppointmentStatusLabels()
  const when = useWhen()
  const { data: entries } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () => patientService.timeline(patientId),
  })

  const describe = (e: TimelineEntry): { title: string; meta: string[] } => {
    const at = when(e.at)
    switch (e.kind) {
      case 'appointment':
        return { title: e.label ?? t('timeline.appointment'), meta: [at, e.detail ?? '', e.status ? statusLabels[e.status as AppointmentStatus] ?? e.status : ''] }
      case 'treatment':
        return { title: e.label ?? t('timeline.treatment'), meta: [at, e.detail ? t('teeth.tooth', { n: e.detail }) : '', e.status ? t(`treatmentPlans.itemStatus.${e.status}`, { defaultValue: e.status }) : ''] }
      case 'invoice':
        return { title: t('timeline.invoice', { number: e.label }), meta: [at, e.amount != null ? formatMoney(e.amount) : '', e.status ? tb(`status.${e.status}`, { defaultValue: e.status }) : ''] }
      case 'payment':
        return { title: t('timeline.payment'), meta: [at, e.amount != null ? formatMoney(e.amount) : '', e.status ? tb(`paymentMethod.${e.status}`, { defaultValue: e.status }) : '', e.label ?? ''] }
      case 'document':
        return { title: e.label ?? t('timeline.document'), meta: [at, e.status ?? ''] }
      case 'finding': {
        // "36 Filling MOD" from the API: the tooth, the condition, the surfaces
        const [tooth, condition, surfaces] = (e.label ?? '').split(' ')
        const what = [t(`teeth.condition.${condition}`, { defaultValue: condition }), surfaces].filter(Boolean).join(' ')
        return { title: `${t('teeth.tooth', { n: tooth })} · ${what}`, meta: [at] }
      }
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('timeline.title')}</h2>
      {entries && entries.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('timeline.empty')}</p>
      ) : (
        <ul aria-label={t('timeline.title')} className="divide-y divide-gray-100 dark:divide-gray-700">
          {(entries ?? []).map((e) => {
            const { icon: Icon, tint } = ICONS[e.kind] ?? ICONS.document
            const { title, meta } = describe(e)
            return (
              <li key={`${e.kind}-${e.refId}`} className="flex gap-3 py-2.5">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}><Icon size={15} aria-hidden /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{meta.filter(Boolean).join(' · ')}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
