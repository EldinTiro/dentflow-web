import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  /** Typed back to confirm: there is no undo. */
  name: string
  title: string
  description: ReactNode
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The Administrator's permanent delete (user request 2026-11-13). Nothing can bring the data
 * back, so the button opens only once the person's name is typed.
 */
export function PermanentDeleteDialog({ open, name, title, description, isPending = false, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const [typed, setTyped] = useState('')

  useEffect(() => { if (!open) setTyped('') }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onCancel])

  if (!open) return null
  const matches = typed.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-300">
            <AlertTriangle size={16} aria-hidden />
          </span>
          <h3 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">{description}</div>
        <label className="mb-6 block text-sm text-gray-700 dark:text-gray-300">
          {t('permanentDelete.typeToConfirm', { name })}
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={t('permanentDelete.typeToConfirm', { name })}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-control bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isPending}
            className="rounded-lg border border-control px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            {t('button.cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={!matches || isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {t('permanentDelete.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
