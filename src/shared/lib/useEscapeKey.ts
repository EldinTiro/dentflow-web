import { useEffect, useRef } from 'react'

/**
 * Calls `onEscape` when Escape is pressed. Pass `enabled = false` while something
 * stacked on top (a confirm dialog, a nested drawer) should take the key instead.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
