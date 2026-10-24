import { useEffect, useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { logout } from '@/features/auth/services/authService'
import { tenantService } from '@/features/admin/services/tenantService'
import { cn } from '@/shared/lib/utils'
import { canViewFinance } from '@/shared/lib/permissions'
import { useTheme } from '@/shared/context/ThemeContext'
import { FeatureProvider } from '@/shared/context/FeatureContext'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { useUserPreferences, useUpdateUserPreferences } from '@/features/auth/hooks/useUserPreferences'
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  Settings2,
  LogOut,
  Moon,
  Sun,
  Stethoscope,
  UserCircle,
  Menu,
  X,
  Globe,
  Landmark,
} from 'lucide-react'

const langOptions = [
  { code: 'en', label: 'English' },
  { code: 'bs', label: 'Bosanski' },
  { code: 'de', label: 'Deutsch' },
] as const

const navItems = [
  { labelKey: 'nav.dashboard', to: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.patients', to: '/patients', icon: Users },
  { labelKey: 'nav.staff', to: '/staff', icon: UserCog },
  { labelKey: 'nav.appointments', to: '/appointments', icon: CalendarDays },
  // Clinic-level money; the desk reaches a patient's bill from the patient instead.
  { labelKey: 'nav.finance', to: '/finance', icon: Landmark, financeOnly: true },
]

export function AppShell() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.roles?.includes('SuperAdmin') ?? false
  // Owner-only settings (appointment types). Team is gone: people live in Staff (people-merge D5).
  const canManageSettings = user?.roles?.includes('ClinicOwner') ?? false
  const canFinance = canViewFinance(user?.roles ?? [])
  const { theme, setTheme } = useTheme()
  // The saved preference is the one source of truth for light/dark (QA-021): applied
  // when the shell loads, and the header toggle writes back to it.
  const { data: preferences } = useUserPreferences()
  const updatePreferences = useUpdateUserPreferences()
  useEffect(() => {
    if (preferences?.theme === 'light' || preferences?.theme === 'dark') setTheme(preferences.theme)
  }, [preferences?.theme, setTheme])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (preferences) updatePreferences.mutate({ ...preferences, theme: next })
  }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  const { data: currentTenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: tenantService.getCurrent,
    enabled: !isSuperAdmin,
    retry: false,
  })

  const sidebarContent = (
    <>
      <div className="h-[3px] bg-gradient-to-r from-primary-500 to-primary-700 shrink-0" />
      <div className="flex h-14 items-center border-b border-gray-200 dark:border-gray-800 px-5">
        {currentTenant?.logoBase64 ? (
          <img
            src={currentTenant.logoBase64}
            alt={currentTenant.name}
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <span className="text-base font-bold text-primary-600 dark:text-primary-400">
            {currentTenant?.name ?? t('nav.appName')}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.filter((item) => !item.financeOnly || canFinance).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
                  )
                }
              >
                <item.icon size={16} className="shrink-0" />
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {canManageSettings && (
        <div className="px-3 pb-2 space-y-1">
          <NavLink
            to="/settings/appointment-types"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )
            }
          >
            <Stethoscope size={16} className="shrink-0" />
            {t('nav.appointmentTypes')}
          </NavLink>
        </div>
      )}

      {isSuperAdmin && (
        <div className="px-3 pb-2">
          <Link
            to="/admin"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950 transition-colors"
          >
            <Settings2 size={16} className="shrink-0" /> {t('nav.adminPanel')}
          </Link>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{user?.fullName}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
        <div className="mt-2 space-y-0.5">
          <NavLink
            to="/settings/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )
            }
          >
            <UserCircle size={13} className="shrink-0" />
            {t('nav.profileSettings')}
          </NavLink>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <LogOut size={13} className="shrink-0" />
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex w-64 flex-col bg-white dark:bg-gray-900 h-full shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
              aria-label={t('aria.closeSidebar')}
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
              aria-label={t('aria.openSidebar')}
            >
              <Menu size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {/* Language switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((p) => !p)}
                aria-label={t('aria.language')}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors text-xs font-medium dark:text-gray-400"
              >
                <Globe size={16} />
                <span className="hidden sm:inline uppercase">{i18n.language?.substring(0, 2)}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 z-40 mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {langOptions.map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => { i18n.changeLanguage(opt.code); setLangOpen(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg',
                          i18n.language === opt.code
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={toggleTheme}
              aria-label={t('aria.toggleDarkMode')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors dark:text-gray-400"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <FeatureProvider>
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </FeatureProvider>
        </main>
      </div>
    </div>
  )
}
