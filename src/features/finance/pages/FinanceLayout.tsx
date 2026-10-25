import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'

/** The owner's Finance section: one sidebar entry, tabs inside. Route-guarded to finance.view roles. */
export function FinanceLayout() {
  const { t } = useTranslation('finance')
  const tabs = [
    { to: '/finance', label: t('tab.overview'), end: true },
    { to: '/finance/invoices', label: t('tab.invoices'), end: false },
    { to: '/finance/cash-up', label: t('tab.cashUp'), end: false },
    { to: '/finance/debtors', label: t('tab.debtors'), end: false },
  ]

  return (
    <div className="min-h-full">
      <div className="px-4 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('title')}</h1>
        <nav aria-label={t('title')} className="mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
