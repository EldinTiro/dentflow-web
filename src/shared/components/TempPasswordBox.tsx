import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'

/**
 * A one-time password someone has to pass on. Copy button because it used to be
 * select-and-copy by hand (QA-030); the user must replace it at first sign-in (QA-011).
 */
export function TempPasswordBox({ password }: { password: string }) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const code = useRef<HTMLElement>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // DT-27: the browser can refuse clipboard access; select the text so Ctrl+C works.
      setCopyFailed(true)
      if (code.current) window.getSelection()?.selectAllChildren(code.current)
    }
  }

  return (
    <div>
    <div className="flex items-stretch gap-2">
      <code ref={code} className="flex-1 font-mono text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-2 py-1 rounded border border-amber-200 dark:border-amber-700 break-all">
        {password}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-700 px-2 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        {copied ? t('tempPassword.copied') : t('tempPassword.copy')}
      </button>
    </div>
      {copyFailed && <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('tempPassword.copyFailed')}</p>}
    </div>
  )
}
