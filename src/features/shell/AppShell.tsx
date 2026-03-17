import { Outlet, NavLink, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { logout } from '@/features/auth/services/authService'
import { tenantService } from '@/features/admin/services/tenantService'
import { cn } from '@/shared/lib/utils'
import { useTheme } from '@/shared/context/ThemeContext'
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  UsersRound,
  Settings2,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Patients', to: '/patients', icon: Users },
  { label: 'Staff', to: '/staff', icon: UserCog },
  { label: 'Appointments', to: '/appointments', icon: CalendarDays },
]

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.roles?.includes('SuperAdmin') ?? false
  const canManageTeam = user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin'].includes(r)) ?? false
  const { theme, toggle } = useTheme()

  const { data: currentTenant } = useQuery({
    queryKey: ['tenant-current'],
    queryFn: tenantService.getCurrent,
    enabled: !isSuperAdmin,
    retry: false,
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="flex h-14 items-center border-b border-gray-200 dark:border-gray-800 px-5">
          {currentTenant?.logoBase64 ? (
            <img
              src={currentTenant.logoBase64}
              alt={currentTenant.name}
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-base font-bold text-blue-600">
              {currentTenant?.name ?? 'PearlDesk'}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
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

        {canManageTeam && (
          <NavLink
            to="/settings/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )
            }
          >
            <UsersRound size={16} className="shrink-0" />
            Team
          </NavLink>
        )}

        {isSuperAdmin && (
          <div className="px-3 pb-2">
            <Link
              to="/admin"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
            >
              <Settings2 size={16} className="shrink-0" /> Admin Panel
            </Link>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
          <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{user?.fullName}</p>
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <LogOut size={13} className="shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 px-6">
          <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {user?.roles?.[0] ?? 'Staff'}
          </h1>
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
