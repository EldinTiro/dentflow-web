import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { statsService } from '../services/statsService'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export function AdminDashboardPage() {
  const { t } = useTranslation('admin')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: statsService.getPlatformStats,
  })

  if (isLoading) {
    return (
      <div className="p-8 text-gray-500 text-sm">{t('dashboard.loading')}</div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-red-500 text-sm">{t('dashboard.error')}</div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard label={t('dashboard.totalTenants')} value={data.totalTenants} />
        <StatCard label={t('dashboard.activeTenants')} value={data.activeTenants} />
        <StatCard label={t('dashboard.inactiveTenants')} value={data.inactiveTenants} />
        <StatCard label={t('dashboard.totalUsers')} value={data.totalUsers} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.usersByRole')}</h2>
          {data.usersByRole.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('dashboard.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {data.usersByRole.map((r) => (
                <li key={r.role} className="flex justify-between text-sm">
                  <span className="text-gray-600">{r.role}</span>
                  <span className="font-medium text-gray-900">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('dashboard.planDistribution')}</h2>
          {data.planDistribution.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('dashboard.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {data.planDistribution.map((p) => (
                <li key={p.plan} className="flex justify-between text-sm">
                  <span className="text-gray-600">{p.plan}</span>
                  <span className="font-medium text-gray-900">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
