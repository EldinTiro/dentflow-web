import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { staffService } from '@/features/staff/services/staffService'
import { treatmentService } from '@/features/treatments/services/treatmentService'
import { formatMoney } from '@/shared/lib/format'
import type { PatientResponse } from '../services/patientService'
import { useWhen } from './PatientWhen'

/** The four numbers at the top of a record: next visit, last visit, balance, treatment progress. */
export function PatientKeyFacts({ patient }: { patient: PatientResponse }) {
  const { t } = useTranslation('patients')
  const when = useWhen()
  const facts = patient.insights

  const { data: staff } = useQuery({
    queryKey: ['staff', 'all-for-names'],
    queryFn: () => staffService.list({ pageSize: 100, isActive: 'all' }),
  })
  const { data: plans } = useQuery({
    queryKey: ['treatment-plans', patient.id, 'preview'],
    queryFn: () => treatmentService.list(patient.id, { pageSize: 50 }),
  })
  const work = (plans?.items ?? []).flatMap((p) => p.items ?? []).filter((i) => i.status !== 'Declined')
  const done = work.filter((i) => i.status === 'Completed').length
  const doctor = staff?.items.find((s) => s.id === facts?.nextAppointment?.providerId)?.fullName

  const tile = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800'
  const label = 'text-xs font-medium text-gray-600 dark:text-gray-400'
  const value = 'mt-1 text-lg font-semibold text-gray-900 dark:text-white'

  return (
    <ul aria-label={t('facts.title')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li className={tile}>
        <p className={label}>{t('preview.nextAppointment')}</p>
        <p className={value}>{facts?.nextAppointment ? when(facts.nextAppointment.startAt) : t('preview.nothingBooked')}</p>
        {doctor && <p className="truncate text-xs text-gray-600 dark:text-gray-400">{doctor}</p>}
      </li>
      <li className={tile}>
        <p className={label}>{t('preview.lastVisit')}</p>
        <p className={value}>{facts?.lastVisitAt ? when(facts.lastVisitAt, false) : '—'}</p>
      </li>
      <li className={tile}>
        <p className={label}>{t('preview.balance')}</p>
        <p className={`${value} ${facts && facts.balanceDue > 0 ? '!text-amber-800 dark:!text-amber-300' : ''}`}>{formatMoney(facts?.balanceDue ?? 0)}</p>
        {facts && facts.balanceDue <= 0 && <p className="text-xs text-gray-600 dark:text-gray-400">{t('preview.paidUp')}</p>}
      </li>
      <li className={tile}>
        <p className={label}>{t('preview.treatmentPlan')}</p>
        <p className={value}>{work.length > 0 ? `${done} / ${work.length}` : '—'}</p>
        {work.length > 0 && (
          <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.round((done / work.length) * 100)}%` }} />
          </div>
        )}
      </li>
    </ul>
  )
}
