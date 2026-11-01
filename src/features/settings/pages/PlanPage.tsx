import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { tenantService } from '@/features/admin/services/tenantService'

const PLAN_STYLES: Record<string, string> = {
  Free:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Pro:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

/** Clinic settings → subscription plan and its limits (was on the personal profile). */
export function PlanPage() {
  const { t, i18n } = useTranslation('auth')

  const { data: tenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: tenantService.getCurrent,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const { data: features } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantService.getFeatures,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  if (!tenant) return null

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.sectionPlan')}</h2>

      <div className="flex items-center gap-3 mb-5">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_STYLES[tenant.plan] ?? PLAN_STYLES.Free}`}>
          {tenant.plan}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tenant.planExpiresAt
            ? t('profile.plan.expiresOn', { date: new Date(tenant.planExpiresAt).toLocaleDateString(i18n.language) })
            : t('profile.plan.noExpiry')}
        </span>
      </div>

      {features && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('profile.plan.staff')}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {(features.quotas['MaxStaffCount'] ?? 0) === -1
                ? t('profile.plan.unlimited')
                : t('profile.plan.staffCount', { count: features.quotas['MaxStaffCount'] })}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('profile.plan.storage')}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {(features.quotas['StorageLimitGb'] ?? 0) === -1
                ? t('profile.plan.unlimited')
                : t('profile.plan.storageGb', { gb: features.quotas['StorageLimitGb'] })}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
