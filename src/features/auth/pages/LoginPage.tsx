import { LoginForm } from '../components/LoginForm'
import { ToothIcon } from '@/shared/components/ToothIcon'
import { Wordmark } from '@/shared/components/Wordmark'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation('auth')
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-50 px-4 dark:bg-gray-950">
      {/* Soft brand glow behind the mark — decorative */}
      <div
        aria-hidden="true"
        className="enter-glow pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-[70%] rounded-full bg-primary-400/20 blur-3xl dark:bg-primary-500/15"
      />

      {/* Brand mark */}
      <div className="relative mb-8 flex flex-col items-center gap-3">
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
