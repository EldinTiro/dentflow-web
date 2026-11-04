import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FolderOpen, Phone, X } from 'lucide-react'
import { patientService, type PatientResponse } from '../services/patientService'
import { formatDayMonth } from '@/shared/lib/format'
import { ageOn, avatarTint, genderKey, initialsOf } from '../lib/patientDisplay'

/**
 * A quick look at a patient beside the list (patients redesign B): alerts, first and last
 * visit, how often they came, how many files they have and contact — then on to the record.
 */
export function PatientPreviewPanel({ patient, onClose }: {
  patient: PatientResponse
  onClose: () => void
}) {
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
  const facts = patient.insights

  const { data: allergies } = useQuery({
    queryKey: ['allergies', patient.id],
    queryFn: () => patientService.listAllergies(patient.id),
  })

  const age = ageOn(patient.dateOfBirth)
  const gender = genderKey(patient.gender)
  const tile = 'rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60'
  const visitDate = (iso: string) => formatDayMonth(iso, { month: 'short', year: true })

  return (
    <section aria-label={patient.fullName} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTint(patient.id)}`}>{initialsOf(patient.fullName)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{patient.fullName}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {[gender && tc(gender), age !== null && t('age', { count: age }), patient.patientNumber].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={tc('button.close')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          <X size={16} />
        </button>
      </div>

      {(allergies?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allergies!.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-400/10 dark:text-red-300">
              <AlertTriangle size={12} aria-hidden /> {a.allergen}{a.severity ? ` · ${t(`allergySeverity.${a.severity}`, { defaultValue: a.severity })}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {([
          [t('preview.firstVisit'), facts?.firstVisitAt ? visitDate(facts.firstVisitAt) : '—'],
          [t('preview.lastVisit'), facts?.lastVisitAt ? visitDate(facts.lastVisitAt) : '—'],
          [t('preview.visitCount'), facts?.visitCount ?? 0],
          [t('preview.documentCount'), facts?.documentCount ?? 0],
        ] as const).map(([label, value]) => (
          <div key={label} className={tile}>
            <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {(patient.phoneMobile || patient.email) && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {patient.phoneMobile && <a href={`tel:${patient.phoneMobile}`} className="flex items-center gap-2 hover:text-primary-600"><Phone size={14} aria-hidden /> {patient.phoneMobile}</a>}
          {patient.email && <p className="truncate text-gray-600 dark:text-gray-400">{patient.email}</p>}
        </div>
      )}

      <Link to={`/patients/${patient.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800">
        <FolderOpen size={16} aria-hidden /> {t('preview.openRecord')}
      </Link>
    </section>
  )
}
