import { useEffect, useId, useState, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  /** "danger" (default) for deleting and deactivating; "primary" for ordinary actions. */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

const CONFIRM_TONE = {
  danger: 'bg-red-600 hover:bg-red-700',
  primary: 'bg-primary-600 hover:bg-primary-700',
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isPending = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-sm p-6"
      >
        <h3 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">{description}</div>
        {/* Cancel, then the action on the right: the same order as the drawers */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-control dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${CONFIRM_TONE[tone]}`}
          >
            {isPending ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface ConfirmRequest {
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
}

/**
 * "Ask first, then run" for destructive one-click actions (QA-013).
 * Render `dialog` once; call `ask({...})` from the click handler.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ''}
      description={request?.description ?? ''}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      tone={request?.tone}
      onConfirm={() => {
        request?.onConfirm()
        setRequest(null)
      }}
      onCancel={() => setRequest(null)}
    />
  )

  return { ask: setRequest, dialog }
}
