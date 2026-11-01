import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { tenantService, type NotificationConfig } from '@/features/admin/services/tenantService'

const notifSchema = z.object({
  smsEnabled: z.boolean(),
  reminder1HoursBefore: z.number().min(1).max(168).nullable(),
  reminder2HoursBefore: z.number().min(1).max(168).nullable(),
}).refine(
  (d) => !d.smsEnabled || (d.reminder1HoursBefore !== null && d.reminder1HoursBefore >= 1),
  { message: 'profile.clinicSettings.reminder1Required', path: ['reminder1HoursBefore'] },
).refine(
  (d) => d.reminder2HoursBefore === null || (d.reminder1HoursBefore !== null && d.reminder2HoursBefore < d.reminder1HoursBefore),
  { message: 'profile.clinicSettings.reminder2Order', path: ['reminder2HoursBefore'] },
)
type NotifForm = z.infer<typeof notifSchema>

/** Clinic settings → SMS reminders (was the Notifications tab of the profile). */
export function NotificationSettingsPage() {
  const { t } = useTranslation('auth')
  const queryClient = useQueryClient()

  const { data: features } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantService.getFeatures,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const hasSms = features?.flags.includes('SmsNotifications') ?? false

  const { data: notifConfig } = useQuery({
    queryKey: ['notification-config'],
    queryFn: tenantService.getNotificationConfig,
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
      toast.success(t('profile.clinicSettings.notifSaved'))
    },
    onError: () => toast.error(t('profile.clinicSettings.notifFailed')),
  })

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('profile.clinicSettings.smsTitle')}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        {t('profile.clinicSettings.smsHint')}
      </p>

      {!hasSms && (
        <div className="mb-5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {t('profile.clinicSettings.smsUpgrade')}
        </div>
      )}

      <form noValidate onSubmit={notifForm.handleSubmit((v) => saveNotifConfig.mutate(v))} className="space-y-5">
        {/* SMS toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.clinicSettings.smsEnable')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.clinicSettings.smsEnableHint')}</p>
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
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('profile.clinicSettings.reminder1')}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('profile.clinicSettings.send')}</span>
              <input
                type="number"
                min={1}
                max={168}
                className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
                {...notifForm.register('reminder1HoursBefore', { valueAsNumber: true })}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('profile.clinicSettings.hoursBefore')}</span>
            </div>
            {notifForm.formState.errors.reminder1HoursBefore && (
              <p className="text-xs text-red-500 mt-1">{t(notifForm.formState.errors.reminder1HoursBefore.message ?? '')}</p>
            )}
          </div>

          {/* Reminder 2 */}
          {r2 === null ? (
            <button
              type="button"
              onClick={() => notifForm.setValue('reminder2HoursBefore', 2, { shouldValidate: true })}
              className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Plus size={14} /> {t('profile.clinicSettings.addReminder2')}
            </button>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('profile.clinicSettings.reminder2')}</p>
                <button
                  type="button"
                  onClick={() => notifForm.setValue('reminder2HoursBefore', null, { shouldValidate: true })}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400"
                >
                  {t('profile.clinicSettings.remove')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('profile.clinicSettings.send')}</span>
                <input
                  type="number"
                  min={1}
                  max={167}
                  className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500"
                  {...notifForm.register('reminder2HoursBefore', { valueAsNumber: true })}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('profile.clinicSettings.hoursBefore')}</span>
              </div>
              {notifForm.formState.errors.reminder2HoursBefore && (
                <p className="text-xs text-red-500 mt-1">{t(notifForm.formState.errors.reminder2HoursBefore.message ?? '')}</p>
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
            {saveNotifConfig.isPending ? t('profile.clinicSettings.saving') : t('profile.clinicSettings.save')}
          </button>
        </div>
      </form>
    </section>
  )
}
