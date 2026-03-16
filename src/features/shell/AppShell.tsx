import { Outlet, NavLink, Link } from 'react-router'
import { useAuthStore } from '@/features/auth/store/authStore'
import { logout } from '@/features/auth/services/authService'
import { cn } from '@/shared/lib/utils'

const navItems = [
  { label: 'Patients', to: '/patients' },
  { label: 'Staff', to: '/staff' },
  { label: 'Appointments', to: '/appointments' },
]

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.roles?.includes('SuperAdmin') ?? false
  const canManageTeam = user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin'].includes(r)) ?? false

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center border-b border-gray-200 px-5">
          <span className="text-base font-bold text-blue-600">PearlDesk</span>
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
                      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )
                  }
                >
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
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            Team
          </NavLink>
        )}

        {isSuperAdmin && (
          <div className="px-3 pb-2">
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <span>⚙</span> Admin Panel
            </Link>
          </div>
        )}

        <div className="border-t border-gray-200 px-4 py-3">
          <p className="truncate text-xs font-medium text-gray-700">{user?.fullName}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6">
          <h1 className="text-sm font-semibold text-gray-700">
            {user?.roles?.[0] ?? 'Staff'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
