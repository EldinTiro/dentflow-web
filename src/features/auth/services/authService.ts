import apiClient, { refreshAccessToken } from '@/shared/api/client'
import { queryClient } from '@/shared/api/queryClient'
import i18n from '@/i18n'
import { useAuthStore } from '../store/authStore'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  accessToken: string
  expiresIn: number
  userId: string
  email: string
  fullName: string
  roles: string[]
  language: string
}

export async function login(credentials: LoginRequest): Promise<void> {
  // Anything cached belongs to whoever was signed in before.
  queryClient.clear()

  const response = await apiClient.post<LoginResponse>(
    '/api/v1/auth/login',
    credentials,
  )
  const { accessToken, userId, email, fullName, roles, language } = response.data
  useAuthStore.getState().setAuth(accessToken, { userId, email, fullName, roles })
  if (language) {
    await i18n.changeLanguage(language)
  }
}

/**
 * Ends the session on the server too. Without the API call the refresh token
 * family stays live and the cookie remains usable, so "signed out" would only be
 * true in this tab.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/v1/auth/logout')
  } catch {
    // Already expired or unreachable — the local teardown below still has to run.
  } finally {
    useAuthStore.getState().clearAuth()
    queryClient.clear()
  }
}

/**
 * Rebuilds the session on a cold load by exchanging the refresh cookie. The access
 * token is held in memory only, so without this every reload would land on /login.
 */
export async function restoreSession(): Promise<boolean> {
  try {
    await refreshAccessToken()
    return true
  } catch {
    useAuthStore.getState().clearAuth()
    return false
  }
}
