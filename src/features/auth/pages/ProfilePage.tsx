import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { User, Palette, Building2, Bell, Plus } from 'lucide-react'
import { useUserPreferences, useUpdateUserPreferences } from '../hooks/useUserPreferences'
import { userService } from '../services/userService'
import { useTheme, type ColorTheme } from '@/shared/context/ThemeContext'
import { tenantService } from '@/features/admin/services/tenantService'
import type { WeeklySchedule, NotificationConfig } from '@/features/admin/services/tenantService'
import { useAuthStore } from '@/features/auth/store/authStore'

// ── Schemas ────────────────────────────────────────────────────────────────

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.string().min(1),
  timeFormat: z.enum(['12h', '24h']),
  defaultCalendarView: z.enum(['day', 'week', 'month']),
})
type PrefsForm = z.infer<typeof prefsSchema>

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

// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_STYLES: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Pro:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Ponedjeljak', tuesday: 'Utorak', wednesday: 'Srijeda',
  thursday: 'Četvrtak', friday: 'Petak', saturday: 'Subota', sunday: 'Nedjelja',
}
const DEFAULT_SCHEDULE: WeeklySchedule = {
  monday:    { isOpen: true,  start: '08:00', end: '17:00' },
  tuesday:   { isOpen: true,  start: '08:00', end: '17:00' },
  wednesday: { isOpen: true,  start: '08:00', end: '17:00' },
  thursday:  { isOpen: true,  start: '08:00', end: '17:00' },
  friday:    { isOpen: true,  start: '08:00', end: '17:00' },
  saturday:  { isOpen: false, start: '08:00', end: '12:00' },
  sunday:    { isOpen: false, start: '08:00', end: '12:00' },
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

// ── Sub-components ─────────────────────────────────────────────────────────

function TimePicker24({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [h = '08', m = '00'] = value.split(':')
  const cls = `border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed`
  return (
    <div className="flex items-center gap-0.5">
      <select value={h} disabled={disabled} onChange={e => onChange(`${e.target.value}:${m}`)} className={cls}>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-gray-400 select-none font-bold text-xs">:</span>
      <select value={m} disabled={disabled} onChange={e => onChange(`${h}:${e.target.value}`)} className={cls}>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  )
}

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

// ── Main component ─────────────────────────────────────────────────────────

const notifSchema = z.object({
  smsEnabled: z.boolean(),
  reminder1HoursBefore: z.number().min(1).max(168).nullable(),
  reminder2HoursBefore: z.number().min(1).max(168).nullable(),
}).refine(
  (d) => !d.smsEnabled || (d.reminder1HoursBefore !== null && d.reminder1HoursBefore >= 1),
  { message: 'Podsjetnik 1 je obavezan kada je SMS aktivan', path: ['reminder1HoursBefore'] },
).refine(
  (d) => d.reminder2HoursBefore === null || (d.reminder1HoursBefore !== null && d.reminder2HoursBefore < d.reminder1HoursBefore),
  { message: 'Podsjetnik 2 mora biti manji od Podsjetnika 1', path: ['reminder2HoursBefore'] },
)
type NotifForm = z.infer<typeof notifSchema>

type Tab = 'profile' | 'appearance' | 'clinic' | 'notifications'

export function ProfilePage() {
  const { t, i18n } = useTranslation('auth')
  const { setTheme, colorTheme, setColorTheme } = useTheme()
  const queryClient = useQueryClient()
  const isSuperAdmin = useAuthStore((s) => s.user?.roles?.includes('SuperAdmin') ?? false)
  const canManageClinic = useAuthStore(
    (s) => s.user?.roles?.some(r => ['ClinicOwner', 'ClinicAdmin'].includes(r)) ?? false,
  )

  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userService.getProfile,
  })

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

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: tenantService.getSettings,
    enabled: canManageClinic,
    staleTime: 5 * 60 * 1000,
  })

  // ── Clinic settings state ─────────────────────────────────────────────────

  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE)
  const [localDuration, setLocalDuration] = useState(30)

  useEffect(() => {
    if (clinicSettings) {
      setLocalDuration(clinicSettings.slotDurationMinutes)
      if (clinicSettings.weeklyScheduleJson) {
        try {
          setLocalSchedule(JSON.parse(clinicSettings.weeklyScheduleJson) as WeeklySchedule)
        } catch { setLocalSchedule(DEFAULT_SCHEDULE) }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicSettings])

  function updateDay(day: string, patch: Partial<{ isOpen: boolean; start: string; end: string }>) {
    setLocalSchedule(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const saveClinicSettings = useMutation({
    mutationFn: () => tenantService.updateSettings({
      slotDurationMinutes: Number(localDuration),
      weeklyScheduleJson: JSON.stringify(localSchedule),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['clinic-settings'], updated)
      toast.success('Radno vrijeme sačuvano')
    },
    onError: () => toast.error('Greška pri čuvanju radnog vremena'),
  })

  // ── Notification config ───────────────────────────────────────────────────

  const hasSms = features?.flags.includes('SmsNotifications') ?? false

  const { data: notifConfig } = useQuery({
    queryKey: ['notification-config'],
    queryFn: tenantService.getNotificationConfig,
    enabled: canManageClinic,
    staleTime: 5 * 60 * 1000,
  })

  const notifForm = useForm<NotifForm>({
    resolver: zodResolver(notifSchema),
    defaultValues: { smsEnabled: false, reminder1HoursBefore: 24, reminder2HoursBefore: null },
  })

  const smsEnabled = notifForm.watch('smsEnabled')
  const r2 = notifForm.watch('reminder2HoursBefore')

  useEffect(() => {
    if (notifConfig) {
      notifForm.reset({
        smsEnabled: notifConfig.smsEnabled,
        reminder1HoursBefore: notifConfig.reminder1HoursBefore ?? 24,
        reminder2HoursBefore: notifConfig.reminder2HoursBefore,
      } satisfies NotifForm)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifConfig])

  const saveNotifConfig = useMutation({
    mutationFn: (values: NotifForm) => tenantService.updateNotificationConfig({
      smsEnabled: values.smsEnabled,
      reminder1HoursBefore: values.reminder1HoursBefore,
      reminder2HoursBefore: values.reminder2HoursBefore,
    }),
    onSuccess: (updated: NotificationConfig) => {
      queryClient.setQueryData(['notification-config'], updated)
      toast.success('Postavke notifikacija sačuvane')
    },
    onError: () => toast.error('Greška pri čuvanju postavki notifikacija'),
  })

  // ── Preferences ───────────────────────────────────────────────────────────

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
    { id: 'profile',    label: 'Profil',   icon: <User size={15} /> },
    { id: 'appearance', label: 'Izgled',   icon: <Palette size={15} /> },
    ...(canManageClinic ? [{ id: 'clinic' as Tab, label: 'Klinika', icon: <Building2 size={15} /> }] : []),
    ...(canManageClinic ? [{ id: 'notifications' as Tab, label: 'Notifikacije', icon: <Bell size={15} /> }] : []),
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
          </section>

          {/* Subscription plan */}
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

          {/* Change password */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionChangePassword')}</h2>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <FieldRow label={t('profile.pwd.currentPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('currentPassword')} />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </FieldRow>

              <FieldRow label={t('profile.pwd.newPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('newPassword')} />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </FieldRow>

              <FieldRow label={t('profile.pwd.confirmNewPassword')}>
                <input type="password" className={INPUT_CLS} {...passwordForm.register('confirmPassword')} />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
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
          <form onSubmit={prefsForm.handleSubmit(handleSavePrefs)} className="space-y-4">
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
        </section>
      )}

      {/* ── Tab: Notifikacije ────────────────────────────────────────────── */}
      {activeTab === 'notifications' && canManageClinic && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">SMS podsjetnici</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
            Automatski SMS podsjetnici šalju se pacijentima koji su dali pristanak.
          </p>

          {!hasSms && (
            <div className="mb-5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              SMS podsjetnici su dostupni na Pro i Enterprise planovima.
            </div>
          )}

          <form onSubmit={notifForm.handleSubmit((v) => saveNotifConfig.mutate(v))} className="space-y-5">
            {/* SMS toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aktiviraj SMS podsjetnike</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Šalje podsjetnike pacijentima koji imaju SMS pristanak</p>
              </div>
              <button
                type="button"
                disabled={!hasSms}
                onClick={() => notifForm.setValue('smsEnabled', !smsEnabled, { shouldValidate: true })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                  smsEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${smsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Reminders */}
            <div className={`space-y-3 transition-opacity ${!smsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* Reminder 1 */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Podsjetnik 1</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Pošalji</span>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
                    {...notifForm.register('reminder1HoursBefore', { valueAsNumber: true })}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">sati prije termina</span>
                </div>
                {notifForm.formState.errors.reminder1HoursBefore && (
                  <p className="text-xs text-red-500 mt-1">{notifForm.formState.errors.reminder1HoursBefore.message}</p>
                )}
              </div>

              {/* Reminder 2 */}
              {r2 === null ? (
                <button
                  type="button"
                  onClick={() => notifForm.setValue('reminder2HoursBefore', 2, { shouldValidate: true })}
                  className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <Plus size={14} /> Dodaj drugi podsjetnik
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Podsjetnik 2</p>
                    <button
                      type="button"
                      onClick={() => notifForm.setValue('reminder2HoursBefore', null, { shouldValidate: true })}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Ukloni
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pošalji</span>
                    <input
                      type="number"
                      min={1}
                      max={167}
                      className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
                      {...notifForm.register('reminder2HoursBefore', { valueAsNumber: true })}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">sati prije termina</span>
                  </div>
                  {notifForm.formState.errors.reminder2HoursBefore && (
                    <p className="text-xs text-red-500 mt-1">{notifForm.formState.errors.reminder2HoursBefore.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-100 dark:border-gray-800 pt-4">
              <button
                type="submit"
                disabled={saveNotifConfig.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saveNotifConfig.isPending ? 'Čuvam…' : 'Sačuvaj'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Tab: Klinika ─────────────────────────────────────────────────── */}
      {activeTab === 'clinic' && canManageClinic && (
        <div className="space-y-4">

        {/* Color theme picker */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tema boja</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Primarna boja sučelja za vašu kliniku.</p>
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
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Radno vrijeme klinike</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
            Radno vrijeme po danima. Termini se generišu samo za otvorene dane.
          </p>

          {/* Per-day schedule */}
          <div className="space-y-2 mb-5">
            <div className="grid grid-cols-[130px_1fr_1fr_1fr] gap-2 mb-1">
              <span />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 text-center">Početak</span>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 text-center">Kraj</span>
              <span />
            </div>
            {DAYS.map(day => {
              const d = localSchedule[day] ?? DEFAULT_SCHEDULE[day]
              return (
                <div key={day} className={`grid grid-cols-[130px_1fr_1fr_auto] gap-2 items-center py-2 px-3 rounded-lg transition-colors ${d.isOpen ? 'bg-gray-50 dark:bg-gray-800/50' : 'opacity-50'}`}>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={d.isOpen}
                      onChange={e => updateDay(day, { isOpen: e.target.checked })}
                      className="rounded accent-primary-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{DAY_LABELS[day]}</span>
                  </label>
                  <TimePicker24 value={d.start} disabled={!d.isOpen} onChange={v => updateDay(day, { start: v })} />
                  <TimePicker24 value={d.end}   disabled={!d.isOpen} onChange={v => updateDay(day, { end: v })} />
                  {!d.isOpen
                    ? <span className="text-xs text-gray-400 dark:text-gray-500">Zatvoreno</span>
                    : <span />
                  }
                </div>
              )
            })}
          </div>

          {/* Slot duration + save */}
          <div className="flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Trajanje termina
            </label>
            <select
              value={localDuration}
              onChange={e => setLocalDuration(Number(e.target.value))}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
            >
              {SLOT_DURATION_OPTIONS.map(d => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => saveClinicSettings.mutate()}
              disabled={saveClinicSettings.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saveClinicSettings.isPending ? 'Čuvam…' : 'Sačuvaj'}
            </button>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}
