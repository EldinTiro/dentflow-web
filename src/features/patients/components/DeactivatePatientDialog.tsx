import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscapeKey } from '@/shared/lib/useEscapeKey'

interface Props {
  name: string
  isPending: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/** People-merge plan D8: deactivate (reversible, keeps everything) with an optional reason. */
export function DeactivatePatientDialog({ name, isPending, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const titleId = useId()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  useEscapeKey(() => { if (!isPending) onCancel() })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-5 space-y-4">
        <h3 id={titleId} className="font-semibold text-gray-900 dark:text-white">{t('status.deactivateTitle', { name })}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('status.deactivateBody')}</p>
        <div>
          <label htmlFor={reasonId} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            {t('status.reason')}
          </label>
          <textarea id={reasonId} value={reason} maxLength={500} rows={2} onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
        </div>
        <div className="flex gap-3">
          <button type="button" disabled={isPending} onClick={() => onConfirm(reason)}
            className="flex-1 bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {t('status.deactivate')}
          </button>
          <button type="button" disabled={isPending} onClick={onCancel}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            {tc('button.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
