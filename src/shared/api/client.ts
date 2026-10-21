import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

type TokenStampedRequest = InternalAxiosRequestConfig & {
  _retried?: boolean
  _tokenUsed?: string
}

import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/store/authStore'

const apiClient = axios.create({
  // Always use relative URLs — Vite proxies /api in dev, nginx proxies /api in prod.
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  // The refresh token rides in an HttpOnly cookie.
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Remembered so a 401 can tell "my token expired" from "someone already
  // replaced it while this request was in flight".
  ;(config as TokenStampedRequest)._tokenUsed = token ?? undefined
  config.headers['Accept-Language'] = i18n.language || 'en'
  return config
})

interface RefreshResponse {
  accessToken: string
  userId: string
  email: string
  fullName: string
  roles: string[]
}

/**
 * Bare axios on purpose: going through apiClient would re-enter the interceptor
 * below and recurse when the refresh itself returns 401.
 */
async function requestNewAccessToken(): Promise<string> {
  const { data } = await axios.post<RefreshResponse>(
    '/api/v1/auth/refresh',
    null,
    { withCredentials: true },
  )

  useAuthStore.getState().setAuth(data.accessToken, {
    userId: data.userId,
    email: data.email,
    fullName: data.fullName,
    roles: data.roles,
  })

  return data.accessToken
}

/**
 * One refresh at a time. Several requests usually fail together when a token
 * expires, and without this each would rotate the cookie — which the server
 * reads as token reuse and answers by revoking the whole family.
 */
let inFlightRefresh: Promise<string> | null = null

export function refreshAccessToken(): Promise<string> {
  inFlightRefresh ??= requestNewAccessToken().finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as TokenStampedRequest | undefined

    const isAuthCall = original?.url?.includes('/api/v1/auth/')
    const recoverable =
      error.response?.status === 401 && original && !original._retried && !isAuthCall

    if (!recoverable) {
      // A 401 we cannot recover from means the session is genuinely over.
      if (error.response?.status === 401 && !isAuthCall) {
        useAuthStore.getState().clearAuth()
      }
      return Promise.reject(error)
    }

    original._retried = true

    try {
      const current = useAuthStore.getState().accessToken

      // If the token already moved on, this request simply lost the race and only
      // needs the newer one. Refreshing again would rotate the cookie a second
      // time, and a rotation that races the browser's Set-Cookie sends a spent
      // token — which the server treats as reuse and answers by revoking the
      // whole family, logging the user out.
      const token =
        current && current !== original._tokenUsed ? current : await refreshAccessToken()

      original.headers.Authorization = `Bearer ${token}`
      return apiClient(original)
    } catch {
      useAuthStore.getState().clearAuth()
      return Promise.reject(error)
    }
  },
)

export default apiClient
