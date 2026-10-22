import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'

interface RoleGuardProps {
  allowedRoles: string[]
}

/**
 * Says so when the role is not allowed. Redirecting silently (or rendering a page
 * whose API calls all 403) left users looking at an empty table (QA-022).
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { t } = useTranslation('common')
  const roles = useAuthStore(selectRoles)
  const hasAccess = allowedRoles.some((r) => roles.includes(r))

  if (!hasAccess) {
    return (
      <div role="alert" className="m-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={16} aria-hidden /> {t('accessDenied.title')}
        </div>
        <p className="mt-1">{t('accessDenied.description')}</p>
        <Link to="/" className="mt-3 inline-block font-medium text-primary-700 hover:underline dark:text-primary-400">
          {t('accessDenied.back')}
        </Link>
      </div>
    )
  }

  return <Outlet />
}
