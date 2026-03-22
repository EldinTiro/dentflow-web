import apiClient from '@/shared/api/client'
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

export function logout(): void {
  useAuthStore.getState().clearAuth()
}
