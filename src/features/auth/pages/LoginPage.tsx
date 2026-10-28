import { LoginForm } from '../components/LoginForm'
import { ToothIcon } from '@/shared/components/ToothIcon'
import { Wordmark } from '@/shared/components/Wordmark'
import { useTranslation } from 'react-i18next'

/** Each name in its own language, so it is recognisable whatever is showing now. */
const LANGUAGES = [
  { code: 'bs', label: 'Bosanski' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
] as const

export function LoginPage() {
  const { t, i18n } = useTranslation('auth')
  const current = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-50 px-4 dark:bg-gray-950">
      {/* DT-28: the page kept the last user's language; choose it here before signing in */}
      <nav aria-label={t('common:aria.language')} className="absolute right-4 top-4 flex gap-1 text-xs">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={current === l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={`rounded-md px-2 py-1 font-medium ${current === l.code
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
          >
            {l.label}
          </button>
        ))}
      </nav>
      {/* Brand mark */}
      <div className="relative mb-8 flex flex-col items-center gap-3">
        {/* Soft brand halo centred on the logo tile; sized to the viewport so it
            never spills across a phone screen. Decorative. */}
        <div
          aria-hidden="true"
          className="enter-glow pointer-events-none absolute left-1/2 top-8 -z-10 size-[min(30rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-400/20 blur-3xl dark:bg-primary-500/15"
        />
        <div className="enter-pop flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-200 dark:shadow-none">
          <ToothIcon size={34} className="text-white" strokeWidth={1.6} />
        </div>
        <div className="text-center">
          <h1 className="enter-up [--enter-delay:150ms] text-[1.375rem] font-semibold leading-tight text-gray-900 dark:text-gray-100"><Wordmark /></h1>
          <p className="enter-up [--enter-delay:220ms] text-sm text-gray-500 dark:text-gray-400 mt-1.5">{t('login.subtitle')}</p>
        </div>
      </div>

      <div className="enter-up [--enter-delay:320ms] relative flex w-full justify-center">
        <LoginForm />
      </div>
    </div>
  )
}
