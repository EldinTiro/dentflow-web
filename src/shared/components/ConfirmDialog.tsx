interface ConfirmDialogProps {
  open: boolean
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? `${confirmLabel}…` : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
