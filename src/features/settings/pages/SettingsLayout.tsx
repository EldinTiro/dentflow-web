import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Clock, Stethoscope, MessageSquare, CreditCard } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Clinic settings (owner): everything about the clinic in one place, apart from the
 * personal profile. Working hours, service types, SMS reminders, plan.
 */
export function SettingsLayout() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { t: ta } = useTranslation('auth')

  const items = [
    { to: '/settings/hours', label: t('clinic.nav.hours'), icon: Clock },
    { to: '/settings/appointment-types', label: tc('nav.appointmentTypes'), icon: Stethoscope },
    { to: '/settings/notifications', label: t('clinic.nav.sms'), icon: MessageSquare },
    { to: '/settings/plan', label: ta('profile.sectionPlan'), icon: CreditCard },
  ]

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('clinic.title')}</h1>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="md:w-56 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
                    )
                  }
                >
                  <item.icon size={16} className="shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
