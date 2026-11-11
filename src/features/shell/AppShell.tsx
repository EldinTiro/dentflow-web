import { useEffect, useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { tenantService } from '@/features/admin/services/tenantService'
import { cn } from '@/shared/lib/utils'
import { canViewFinance } from '@/shared/lib/permissions'
import { useTheme } from '@/shared/context/ThemeContext'
import { FeatureProvider } from '@/shared/context/FeatureContext'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { useUserPreferences, useUpdateUserPreferences } from '@/features/auth/hooks/useUserPreferences'
import { UserMenu, initialsOf } from './UserMenu'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { toLocalIsoDate } from '@/shared/lib/dates'
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  Settings2,
  Moon,
  Sun,
  Settings,
  Menu,
  X,
  Globe,
  Landmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const langOptions = [
  { code: 'en', label: 'English' },
  { code: 'bs', label: 'Bosanski' },
  { code: 'de', label: 'Deutsch' },
] as const

interface NavItem {
  labelKey: string
  to: string
  icon: typeof LayoutDashboard
  show?: 'finance' | 'settings'
}

// Sidebar mock A: what the desk opens all day, apart from running the clinic.
const navGroups: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'nav.groupDaily',
    items: [
      { labelKey: 'nav.dashboard', to: '/dashboard', icon: LayoutDashboard },
      { labelKey: 'nav.appointments', to: '/appointments', icon: CalendarDays },
      { labelKey: 'nav.patients', to: '/patients', icon: Users },
    ],
  },
  {
    labelKey: 'nav.groupClinic',
    items: [
      { labelKey: 'nav.staff', to: '/staff', icon: UserCog },
      // Clinic-level money; the desk reaches a patient's bill from the patient instead.
      { labelKey: 'nav.finance', to: '/finance', icon: Landmark, show: 'finance' },
      // Owner-only: working hours, service types, SMS and plan
      { labelKey: 'nav.settings', to: '/settings', icon: Settings, show: 'settings' },
    ],
  },
]

/** Visits today that are still on: not cancelled, not a no-show. */
function useTodayCount(enabled: boolean) {
  const today = toLocalIsoDate(new Date())
  // Same query as the dashboard's "today", so both share one request
  const { data } = useQuery({
    queryKey: ['appointments-today', today],
    queryFn: () => appointmentService.list({ dateFrom: today, dateTo: today, pageSize: 50 }),
    enabled,
    staleTime: 60_000,
  })
  return data?.items.filter((a) => a.status !== 'Cancelled' && a.status !== 'NoShow').length
}

export function AppShell() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.roles?.includes('SuperAdmin') ?? false
  // Owner-only clinic settings. Team is gone: people live in Staff (people-merge D5).
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
  // User request 2026-11-11: the desktop sidebar folds to icons; the choice is remembered
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1')
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      return !c
    })
  }
  // [ folds and unfolds it, unless someone is typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      toggleCollapsed()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [langOpen, setLangOpen] = useState(false)

  const todayCount = useTodayCount(!!user && !isSuperAdmin)
  const visible = (item: NavItem) =>
    item.show === 'finance' ? canFinance : item.show === 'settings' ? canManageSettings : true
  const linkClass = (folded: boolean) => ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center rounded-lg text-sm font-medium transition-colors',
      folded ? 'mx-auto h-9 w-10 justify-center' : 'gap-2.5 px-3 py-2',
      isActive
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
    )
  const role = user?.roles?.[0]

  const { data: currentTenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: tenantService.getCurrent,
    enabled: !isSuperAdmin,
    retry: false,
  })

  // `folded`: icons only, every name kept for screen readers and as a tooltip
  const renderSidebar = (folded: boolean) => (
    <>
      <div className="h-[3px] bg-gradient-to-r from-primary-500 to-primary-700 shrink-0" />
      {/* The clinic, and beside it the fold button (mock C); folded, only the button stays */}
      <div className={cn('flex h-14 items-center gap-2 border-b border-gray-200 dark:border-gray-800', folded ? 'justify-center px-2' : 'justify-between pl-5 pr-3')}>
        {!folded && (currentTenant?.logoBase64 ? (
          <img
            src={currentTenant.logoBase64}
            alt={currentTenant.name}
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        ) : (
          <span className="truncate text-base font-bold text-primary-600 dark:text-primary-400">
            {currentTenant?.name ?? t('nav.appName')}
          </span>
        ))}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t(folded ? 'aria.expandSidebar' : 'aria.collapseSidebar')}
          title={`${t(folded ? 'aria.expandSidebar' : 'aria.collapseSidebar')} ([)`}
          className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {folded ? <ChevronRight size={15} strokeWidth={2.5} /> : <ChevronLeft size={15} strokeWidth={2.5} />}
        </button>
      </div>

      <nav className={cn('flex-1 overflow-y-auto py-3', folded ? 'px-2' : 'px-3')}>
        {navGroups.map((group) => {
          const items = group.items.filter(visible)
          if (items.length === 0) return null
          const headingId = `nav-${group.labelKey}`
          return (
            <div key={group.labelKey} role="group" aria-labelledby={headingId} className="mb-3">
              <p id={headingId} className={folded ? 'sr-only' : 'px-3 pb-1 pt-2 text-xs font-medium text-gray-500 dark:text-gray-400'}>{t(group.labelKey)}</p>
              {folded && <div aria-hidden className="mx-2 mb-1 mt-2 border-t border-gray-200 dark:border-gray-800" />}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={linkClass(folded)}
                      title={folded ? t(item.labelKey) : undefined}
                    >
                      <item.icon size={folded ? 18 : 16} className="shrink-0" />
                      <span className={folded ? 'sr-only' : undefined}>{t(item.labelKey)}</span>{' '}
                      {item.to === '/appointments' && !!todayCount && (
                        <span
                          aria-label={t('nav.todayCount', { count: todayCount })}
                          className={folded
                            ? 'absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-primary-600 px-1 text-center text-[10px] font-semibold leading-[1.1rem] tabular-nums text-white'
                            : 'ml-auto rounded-full bg-gray-100 px-2 text-xs font-semibold tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-200'}
                        >
                          {todayCount}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {isSuperAdmin && (
        <div className={folded ? 'px-2 pb-2' : 'px-3 pb-2'}>
          <Link
            to="/admin"
            onClick={() => setSidebarOpen(false)}
            title={folded ? t('nav.adminPanel') : undefined}
            className={cn('flex items-center rounded-lg text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950 transition-colors',
              folded ? 'mx-auto h-9 w-10 justify-center' : 'gap-2.5 px-3 py-2')}
          >
            <Settings2 size={16} className="shrink-0" /> <span className={folded ? 'sr-only' : undefined}>{t('nav.adminPanel')}</span>
          </Link>
        </div>
      )}

      {/* Who is signed in; sign-out stays in the account menu top right */}
      {user && (
        <Link
          to="/profile"
          onClick={() => setSidebarOpen(false)}
          title={folded ? user.fullName : undefined}
          className={cn('flex items-center gap-2.5 border-t border-gray-200 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60',
            folded ? 'justify-center px-2' : 'px-4')}
        >
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {initialsOf(user.fullName)}
          </span>
          <span className={folded ? 'sr-only' : 'min-w-0'}>
            <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user.fullName}</span>
            {role && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{t(`role.${role}`)}</span>}
          </span>
        </Link>
      )}

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
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: full, or folded to icons */}
      <aside
        aria-label={t('aria.mainMenu')}
        data-collapsed={collapsed}
        className={cn('hidden lg:flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 dark:bg-gray-900 dark:border-gray-800',
          collapsed ? 'w-16' : 'w-56')}
      >
        {renderSidebar(collapsed)}
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
            <UserMenu />
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
