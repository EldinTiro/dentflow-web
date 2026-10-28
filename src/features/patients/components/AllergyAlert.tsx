import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { patientService, type MedicalHistory } from '../services/patientService'

/** DT-10: conditions that change how a visit is done, shown before treatment. */
const TREATMENT_FLAGS = [
  'hasBleedingDisorder', 'isOnBloodThinners', 'hasPacemaker', 'hasHeartCondition', 'hasArtificialJoints',
] as const

const SEVERITY_RANK: Record<string, number> = { LifeThreatening: 0, Severe: 1, Moderate: 2, Mild: 3 }
const rank = (severity: string | null) => SEVERITY_RANK[severity ?? ''] ?? 4

interface Props {
  patientId: string
  className?: string
}

/**
 * Allergy banner for anywhere a clinician acts on a patient — header, booking,
 * appointment detail. A life-threatening allergy used to be visible only inside the
 * Medical tab (QA-010). Shares the 'patient-allergies' query with that tab, so it
 * updates as soon as an allergy is added or removed.
 */
export function AllergyAlert({ patientId, className = '' }: Props) {
  const { t } = useTranslation('patients')
  const { data: allergies = [] } = useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: () => patientService.listAllergies(patientId),
    enabled: !!patientId,
  })

  // Same query key as the Medical tab, so ticking a box updates the header at once.
  const { data: history } = useQuery({
    queryKey: ['patient-medical-history', patientId],
    queryFn: () => patientService.getMedicalHistory(patientId),
    enabled: !!patientId,
  })

  const sorted = [...allergies].sort((a, b) => rank(a.severity) - rank(b.severity))
  const allergyLabels = sorted.map((a) => (a.severity ? `${a.allergen} (${t(`allergySeverity.${a.severity}`)})` : a.allergen))
  // Latex ticked in the medical history is an allergy too, unless it's already listed.
  if (history?.hasLatexAllergy && !sorted.some((a) => /latex/i.test(a.allergen))) allergyLabels.push(t('medical.condition.hasLatexAllergy'))
  const conditions = medicalAlerts(history).map((flag) => t(`medical.condition.${flag}`))
  if (history?.isPregnant) conditions.push(t('allergyAlert.pregnant'))

  if (allergyLabels.length === 0 && conditions.length === 0) return null

  const serious = sorted.length > 0 && rank(sorted[0].severity) <= 1
  const tone = serious
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'

  return (
    <div role="alert" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone} ${className}`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        {allergyLabels.length > 0 && (
          <p><span className="font-semibold">{t('allergyAlert.label')}: </span>{allergyLabels.join(', ')}</p>
        )}
        {conditions.length > 0 && (
          <p><span className="font-semibold">{t('allergyAlert.medical')}: </span>{conditions.join(', ')}</p>
        )}
      </div>
    </div>
  )
}

function medicalAlerts(history: MedicalHistory | null | undefined): string[] {
  if (!history) return []
  return TREATMENT_FLAGS.filter((flag) => history[flag])
}
