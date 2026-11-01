import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, Settings2, UserCircle } from 'lucide-react'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { logout } from '@/features/auth/services/authService'

/** "Alma Trako" → "AT"; first and last name only, so "Abdul Samed Ademi" → "AA". */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

const itemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/60'

/**
 * The signed-in person, top right: initials that open name, role, their profile,
 * clinic settings (owner) and sign out. Profile and clinic settings are separate pages.
 */
export function UserMenu() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const roles = useAuthStore(selectRoles)
  const isOwner = roles.includes('ClinicOwner')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!user) return null
  const role = roles[0]

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('aria.userMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white ring-offset-2 transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:ring-offset-gray-900"
      >
        {initialsOf(user.fullName)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 dark:border-gray-700">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
              {initialsOf(user.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user.fullName}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
              {role && <p className="mt-0.5 text-xs font-medium text-primary-700 dark:text-primary-400">{t(`role.${role}`)}</p>}
            </div>
          </div>
          <div className="py-1">
            <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className={itemClass}>
              <UserCircle size={16} className="shrink-0 text-gray-500 dark:text-gray-400" /> {t('nav.myProfile')}
            </Link>
            {isOwner && (
              <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={itemClass}>
                <Settings2 size={16} className="shrink-0 text-gray-500 dark:text-gray-400" /> {t('nav.clinicSettings')}
              </Link>
            )}
          </div>
          <div className="border-t border-gray-100 py-1 dark:border-gray-700">
            <button role="menuitem" type="button" onClick={() => { setOpen(false); logout() }} className={itemClass}>
              <LogOut size={16} className="shrink-0 text-gray-500 dark:text-gray-400" /> {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
