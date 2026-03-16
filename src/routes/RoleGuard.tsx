import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/features/auth/store/authStore'

interface RoleGuardProps {
  allowedRoles: string[]
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const roles = useAuthStore((s) => s.user?.roles ?? [])
  const hasAccess = allowedRoles.some((r) => roles.includes(r))

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
