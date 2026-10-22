import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/features/auth/store/authStore'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isRestoring = useAuthStore((s) => s.isRestoring)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword ?? false)
  const location = useLocation()

  // On a cold load the token is not in memory yet and the refresh exchange is
  // still in flight. Redirecting here would bounce every reload to /login.
  if (isRestoring) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div
          role="status"
          aria-label="Loading"
          className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // The API refuses everything else until the temporary password is replaced (QA-011).
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}
