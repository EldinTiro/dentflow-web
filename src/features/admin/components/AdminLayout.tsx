import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'

const navItems = [
  { to: '/admin', labelKey: 'layout.nav.dashboard', end: true, icon: LayoutDashboard },
  { to: '/admin/tenants', labelKey: 'layout.nav.tenants', icon: Building2 },
  { to: '/admin/users', labelKey: 'layout.nav.users', icon: Users },
]

export function AdminLayout() {
  const { t } = useTranslation('admin')
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{t('layout.brand')}</span>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
            {t('layout.badge')}
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`
              }
            >
              <item.icon size={16} className="shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            {t('layout.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
