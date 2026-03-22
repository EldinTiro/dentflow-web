import { useEffect, useState } from 'react'

interface DrawerProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export function Drawer({ title, onClose, children, width = 'w-[460px]' }: DrawerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-60 flex justify-end">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`relative z-60 ${width} bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full transition-transform duration-200 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
