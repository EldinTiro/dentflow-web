import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { restoreSession } from '@/features/auth/services/authService'
import { useAuthStore } from '@/features/auth/store/authStore'
import { AppRouter } from '@/routes'

/**
 * StrictMode mounts effects twice in development. Each call would rotate the
 * refresh cookie again, so the attempt is made once per page load.
 */
let restoreAttempted = false

export default function App() {
  useEffect(() => {
    if (restoreAttempted) return
    restoreAttempted = true

    // Anyone who used an earlier build still has a JWT sitting in localStorage.
    // Dropping the persistence does not clean that up on its own.
    localStorage.removeItem('pearldesk-auth')

    // The access token lives in memory, so a cold load starts with nothing and
    // the HttpOnly cookie is the only way back into the session.
    void restoreSession().catch(() => {
      useAuthStore.getState().clearAuth()
    })
  }, [])

  return (
    <ThemeProvider>
      <AppRouter />
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  )
}
