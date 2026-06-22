import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useUserPreferences, useUpdateUserPreferences } from '../hooks/useUserPreferences'
import { userService } from '../services/userService'
import { useTheme } from '@/shared/context/ThemeContext'
import { tenantService } from '@/features/admin/services/tenantService'
import { useAuthStore } from '@/features/auth/store/authStore'

// ── Preferences schema ─────────────────────────────────────────────────────

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.string().min(1),
  timeFormat: z.enum(['12h', '24h']),
  defaultCalendarView: z.enum(['day', 'week', 'month']),
})
type PrefsForm = z.infer<typeof prefsSchema>

// ── Password schema ────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(12, 'At least 12 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain a digit')
      .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type PasswordForm = z.infer<typeof passwordSchema>

// ── Component ──────────────────────────────────────────────────────────────

const PLAN_STYLES: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Pro:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

export function ProfilePage() {
  const { t, i18n } = useTranslation('auth')
  const { setTheme } = useTheme()
  const isSuperAdmin = useAuthStore((s) => s.user?.roles?.includes('SuperAdmin') ?? false)

  // ── Profile ──
  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userService.getProfile,
  })

  // ── Tenant plan ──
  const { data: tenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: tenantService.getCurrent,
    enabled: !isSuperAdmin,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const { data: features } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantService.getFeatures,
    enabled: !isSuperAdmin,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  // ── Preferences ──
  const { data: serverPrefs } = useUserPreferences()
  const updatePrefs = useUpdateUserPreferences()

  const prefsForm = useForm<PrefsForm>({
    resolver: zodResolver(prefsSchema),
    defaultValues: { theme: 'light', language: 'en', timeFormat: '24h', defaultCalendarView: 'week' },
  })

  useEffect(() => {
    if (serverPrefs) {
      prefsForm.reset({
        theme: serverPrefs.theme as PrefsForm['theme'],
        language: serverPrefs.language,
        timeFormat: serverPrefs.timeFormat as PrefsForm['timeFormat'],
        defaultCalendarView: serverPrefs.defaultCalendarView as PrefsForm['defaultCalendarView'],
      })
    }
  }, [serverPrefs, prefsForm])

  function handleSavePrefs(values: PrefsForm) {
    updatePrefs.mutate(values, {
      onSuccess: () => {
        setTheme(values.theme)
        i18n.changeLanguage(values.language)
        toast.success(t('profile.toast.preferencesSaved'))
      },
      onError: () => toast.error(t('profile.toast.preferencesFailed', 'Failed to save preferences')),
    })
  }

  // ── Password ──
  const changePassword = useMutation({
    mutationFn: userService.changePassword,
    onSuccess: () => {
      passwordForm.reset()
      toast.success(t('profile.toast.passwordChanged'))
    },
    onError: () => toast.error(t('profile.toast.passwordFailed', 'Failed to change password. Check your current password.')),
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  function handleChangePassword(values: PasswordForm) {
    changePassword.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  }

  // ── Initials ──
  const initials = profile
    ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('profile.title')}</h1>

      {/* ── Profile info ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionProfile')}</h2>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold select-none">
            {initials}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{profile?.fullName ?? '—'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.email ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* ── Subscription plan ────────────────────────────────────────────── */}
      {!isSuperAdmin && tenant && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionPlan')}</h2>

          <div className="flex items-center gap-3 mb-5">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_STYLES[tenant.plan] ?? PLAN_STYLES.Free}`}>
              {tenant.plan}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {tenant.planExpiresAt
                ? t('profile.plan.expiresOn', { date: new Date(tenant.planExpiresAt).toLocaleDateString(i18n.language) })
                : t('profile.plan.noExpiry')}
            </span>
          </div>

          {features && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('profile.plan.staff')}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {(features.quotas['MaxStaffCount'] ?? 0) === -1
                    ? t('profile.plan.unlimited')
                    : t('profile.plan.staffCount', { count: features.quotas['MaxStaffCount'] })}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('profile.plan.storage')}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {(features.quotas['StorageLimitGb'] ?? 0) === -1
                    ? t('profile.plan.unlimited')
                    : t('profile.plan.storageGb', { gb: features.quotas['StorageLimitGb'] })}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionPreferences')}</h2>
        <form onSubmit={prefsForm.handleSubmit(handleSavePrefs)} className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pref.theme')}</label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
              {...prefsForm.register('theme')}
            >
              <option value="light">{t('profile.pref.light')}</option>
              <option value="dark">{t('profile.pref.dark')}</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pref.language')}</label>
            <select className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500" {...prefsForm.register('language')}>
              <option value="en">{t('profile.pref.english')}</option>
              <option value="bs">{t('profile.pref.bosnian')}</option>
              <option value="de">{t('profile.pref.german')}</option>
            </select>
          </div>

          {/* Time format */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pref.timeFormat')}</label>
            <select className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500" {...prefsForm.register('timeFormat')}>
              <option value="24h">{t('profile.pref.24h')}</option>
              <option value="12h">{t('profile.pref.12h')}</option>
            </select>
          </div>

          {/* Default calendar view */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pref.defaultCalendarView')}</label>
            <select className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500" {...prefsForm.register('defaultCalendarView')}>
              <option value="day">{t('profile.pref.day')}</option>
              <option value="week">{t('profile.pref.week')}</option>
              <option value="month">{t('profile.pref.month')}</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updatePrefs.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {updatePrefs.isPending ? t('profile.pref.saving') : t('profile.pref.saveButton')}
            </button>
          </div>
        </form>
      </section>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionChangePassword')}</h2>
        <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pwd.currentPassword')}</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
              {...passwordForm.register('currentPassword')}
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pwd.newPassword')}</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
              {...passwordForm.register('newPassword')}
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.pwd.confirmNewPassword')}</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
              {...passwordForm.register('confirmPassword')}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {changePassword.isPending ? t('profile.pwd.changing') : t('profile.pwd.changeButton')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
