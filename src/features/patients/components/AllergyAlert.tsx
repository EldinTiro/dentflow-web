import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { patientService } from '../services/patientService'

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

  if (allergies.length === 0) return null

  const sorted = [...allergies].sort((a, b) => rank(a.severity) - rank(b.severity))
  const serious = rank(sorted[0].severity) <= 1
  const tone = serious
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'

  return (
    <div role="alert" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone} ${className}`}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">{t('allergyAlert.label')}: </span>
        {sorted
          .map((a) => (a.severity ? `${a.allergen} (${t(`allergySeverity.${a.severity}`)})` : a.allergen))
          .join(', ')}
      </p>
    </div>
  )
}
