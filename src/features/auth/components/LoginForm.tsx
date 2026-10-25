import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { login } from '../services/authService'
import { useAuthStore } from '../store/authStore'
import { cn } from '@/shared/lib/utils'
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError'
import axios from 'axios'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await login(values)
      const roles = useAuthStore.getState().user?.roles ?? []
      navigate(roles.includes('SuperAdmin') ? '/admin' : '/', { replace: true })
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 429) setServerError(t('login.tooManyAttempts'))                       // DT-05
      else if (getApiErrorCodes(err).has('Auth.AccountLocked')) setServerError(t('login.locked')) // DT-05
      // 403 = valid credentials but the clinic is suspended; say so (QA-002).
      else setServerError(status === 403 ? getApiErrorMessage(err) : t('login.invalidCredentials'))
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('login.heading')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('login.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-base sm:text-sm outline-none transition',
              'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
              'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.email ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
            )}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className={cn(
                'w-full rounded-lg border px-3 py-2 pr-10 text-base sm:text-sm outline-none transition',
                'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
                'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                errors.password ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={showPassword ? tc('aria.hidePassword') : tc('aria.showPassword')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-400/10 dark:text-red-300">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white',
            'transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSubmitting ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  )
}
