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

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
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
    } catch {
      setServerError('Invalid email or password.')
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <p className="text-sm text-gray-500">{t('login.heading')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            {t('login.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              errors.email ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className={cn(
                'w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition',
                'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                errors.password ? 'border-red-400' : 'border-gray-300',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white',
            'transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSubmitting ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  )
}
