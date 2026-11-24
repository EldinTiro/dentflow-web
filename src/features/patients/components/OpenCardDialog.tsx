import { useEffect, useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError'
import { patientService } from '../services/patientService'

/** Shown where a card number would be, for a patient whose card is not opened yet. */
export function NoCardBadge() {
  const { t } = useTranslation('patients')
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
      {t('card.none')}
    </span>
  )
}

interface Props {
  patientId: string
  patientName: string
  onClose: () => void
}

/**
 * Opens the card of a patient saved without one (client request 2026-11-10): the paper
 * card's number, or the clinic's next free number when the field is left empty.
 */
export function OpenCardDialog({ patientId, patientName, onClose }: Props) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()
  const titleId = useId()
  const inputId = useId()
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)

  const open = useMutation({
    mutationFn: () => patientService.openCard(patientId, number.trim() || null),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      toast.success(t('card.opened', { name: patientName, number: patient.patientNumber }))
      onClose()
    },
    onError: (err) => setError(getApiErrorCodes(err).has('Patient.PatientNumberAlreadyExists')
      ? t('card.numberTaken', { number: number.trim() })
      : getApiErrorMessage(err, t('card.failed'))),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !open.isPending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open.isPending])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        noValidate
        onSubmit={(e) => { e.preventDefault(); open.mutate() }}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800"
      >
        <h3 id={titleId} className="mb-1 font-semibold text-gray-900 dark:text-white">{t('card.title')}</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t('card.body', { name: patientName })}</p>
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{t('card.number')}</label>
        <input
          id={inputId}
          value={number}
          onChange={(e) => { setNumber(e.target.value); setError(null) }}
          inputMode="numeric"
          autoFocus
          placeholder={t('card.numberPlaceholder')}
          className="w-full rounded-md border border-control bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        {error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={open.isPending}
            className="flex-1 rounded-md bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {t('card.open')}
          </button>
          <button type="button" onClick={onClose} disabled={open.isPending}
            className="flex-1 rounded-md border border-control py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            {t('card.later')}
          </button>
        </div>
      </form>
    </div>
  )
}
