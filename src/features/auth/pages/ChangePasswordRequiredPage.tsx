import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { refreshAccessToken } from '@/shared/api/client'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { userService } from '../services/userService'
import { logout } from '../services/authService'
import { passwordSchema, type PasswordForm } from '../lib/passwordSchema'

const INPUT =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * Shown instead of the app while the user still has a password someone else chose
 * (invite, provisioning, admin reset). The API refuses everything else until it is
 * replaced (QA-011).
 */
export function ChangePasswordRequiredPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const change = useMutation({
    mutationFn: async (v: PasswordForm) => {
      await userService.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      // The current access token still carries the "must change" claim; get a clean one.
      await refreshAccessToken()
    },
    onSuccess: () => navigate('/', { replace: true }),
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound size={18} className="text-primary-600 dark:text-primary-400" aria-hidden />
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('forcePasswordChange.title')}</h1>
        </div>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">{t('forcePasswordChange.description')}</p>

        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="space-y-4" noValidate>
          {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name) => (
            <div key={name}>
              <label htmlFor={name} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t(name === 'confirmPassword' ? 'profile.pwd.confirmNewPassword' : `profile.pwd.${name}`)}
              </label>
              <input id={name} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
                className={INPUT} {...form.register(name)} />
              {errors[name] && <p className="mt-1 text-xs text-red-500">{t(errors[name]?.message ?? '')}</p>}
            </div>
          ))}

          {change.isError && (
            <p role="alert" className="text-sm text-red-600">
              {getApiErrorMessage(change.error, t('profile.toast.passwordFailed'))}
            </p>
          )}

          <button type="submit" disabled={change.isPending}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
            {change.isPending ? t('profile.pwd.changing') : t('profile.pwd.changeButton')}
          </button>
          <button type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }) }}
            className="w-full text-center text-xs text-gray-500 hover:underline dark:text-gray-400">
            {tc('nav.signOut')}
          </button>
        </form>
      </div>
    </div>
  )
}
