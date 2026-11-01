import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { User, Palette } from 'lucide-react'
import { useUserPreferences, useUpdateUserPreferences } from '../hooks/useUserPreferences'
import { userService } from '../services/userService'
import { useTheme, type ColorTheme } from '@/shared/context/ThemeContext'
import { passwordSchema, type PasswordForm } from '../lib/passwordSchema'
import { EditNameForm } from '../components/EditNameForm'

// ── Schemas ────────────────────────────────────────────────────────────────

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.string().min(1),
  timeFormat: z.enum(['12h', '24h']),
  defaultCalendarView: z.enum(['day', 'week', 'month']),
})
type PrefsForm = z.infer<typeof prefsSchema>

// ── Sub-components ─────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLS = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500'
const SELECT_CLS = INPUT_CLS

type Tab = 'profile' | 'appearance'

export function ProfilePage() {
  const { t, i18n } = useTranslation('auth')
  const { setTheme, colorTheme, setColorTheme } = useTheme()

  // DT-31: the tab lives in ?tab= like the patient and staff tabs, so a reload keeps it.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: Tab = (['profile', 'appearance'] as const).find((x) => x === tabParam) ?? 'profile'
  const setActiveTab = (next: Tab) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      if (next === 'profile') n.delete('tab'); else n.set('tab', next)
      return n
    }, { replace: true })

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userService.getProfile,
  })

  // ── Preferences  // ── Preferences ───────────────────────────────────────────────────────────

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

  // ── Password ──────────────────────────────────────────────────────────────

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
    changePassword.mutate({ currentPassword: values.currentPassword, newPassword: values.newPassword })
  }

  const initials = profile
    ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()
    : '?'

  // ── Tab definitions ───────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',    label: t('profile.tab.profile'),    icon: <User size={15} /> },
    { id: 'appearance', label: t('profile.tab.appearance'), icon: <Palette size={15} /> },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        {t('profile.title')}
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg -mb-px border-b-2 ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Profil ──────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Identity card */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionProfile')}</h2>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary-600 flex items-center justify-center text-white text-lg font-bold select-none shrink-0">
                {initials}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{profile?.fullName ?? '—'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.email ?? '—'}</p>
              </div>
            </div>
            {profile && <EditNameForm firstName={profile.firstName} lastName={profile.lastName} />}
          </section>

          {/* Change password */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionChangePassword')}</h2>
            <form noValidate onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FieldRow label={t('profile.pwd.currentPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('currentPassword')} />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-red-500 mt-1">{t(passwordForm.formState.errors.currentPassword.message ?? '')}</p>
                )}
              </FieldRow>

              <FieldRow label={t('profile.pwd.newPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('newPassword')} />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-red-500 mt-1">{t(passwordForm.formState.errors.newPassword.message ?? '')}</p>
                )}
              </FieldRow>

              <FieldRow label={t('profile.pwd.confirmNewPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('confirmPassword')} />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{t(passwordForm.formState.errors.confirmPassword.message ?? '')}</p>
                )}
              </FieldRow>

              <div className="flex justify-end">
                <button type="submit" disabled={changePassword.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                  {changePassword.isPending ? t('profile.pwd.changing') : t('profile.pwd.changeButton')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Tab: Izgled ──────────────────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionPreferences')}</h2>
          <form noValidate onSubmit={prefsForm.handleSubmit(handleSavePrefs)} className="space-y-4">
            <FieldRow label={t('profile.pref.theme')}>
              <select className={SELECT_CLS} {...prefsForm.register('theme')}>
                <option value="light">{t('profile.pref.light')}</option>
                <option value="dark">{t('profile.pref.dark')}</option>
              </select>
            </FieldRow>

            <FieldRow label={t('profile.pref.language')}>
              <select className={SELECT_CLS} {...prefsForm.register('language')}>
                <option value="en">{t('profile.pref.english')}</option>
                <option value="bs">{t('profile.pref.bosnian')}</option>
                <option value="de">{t('profile.pref.german')}</option>
              </select>
            </FieldRow>

            <FieldRow label={t('profile.pref.timeFormat')}>
              <select className={SELECT_CLS} {...prefsForm.register('timeFormat')}>
                <option value="24h">{t('profile.pref.24h')}</option>
                <option value="12h">{t('profile.pref.12h')}</option>
              </select>
            </FieldRow>

            <FieldRow label={t('profile.pref.defaultCalendarView')}>
              <select className={SELECT_CLS} {...prefsForm.register('defaultCalendarView')}>
                <option value="day">{t('profile.pref.day')}</option>
                <option value="week">{t('profile.pref.week')}</option>
                <option value="month">{t('profile.pref.month')}</option>
              </select>
            </FieldRow>

            <div className="flex justify-end">
              <button type="submit" disabled={updatePrefs.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                {updatePrefs.isPending ? t('profile.pref.saving') : t('profile.pref.saveButton')}
              </button>
            </div>
          </form>

          {/* Color theme picker */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('profile.clinicSettings.colorTheme')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('profile.clinicSettings.colorThemeHint')}</p>
            <div className="flex flex-wrap gap-3">
              {([
                { id: 'indigo', label: 'Indigo',  hex: '#4f46e5' },
                { id: 'rose',   label: 'Rose',    hex: '#e11d48' },
                { id: 'teal',   label: 'Teal',    hex: '#0d9488' },
                { id: 'blue',   label: 'Blue',    hex: '#2563eb' },
                { id: 'violet', label: 'Violet',  hex: '#7c3aed' },
              ] as { id: ColorTheme; label: string; hex: string }[]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setColorTheme(t.id)}
                  title={t.label}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    colorTheme === t.id
                      ? 'border-gray-900 dark:border-gray-100 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.hex }} />
                  <span className="text-gray-700 dark:text-gray-300">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}
