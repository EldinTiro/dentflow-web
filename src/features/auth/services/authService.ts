import apiClient from '@/shared/api/client'
import { useAuthStore } from '../store/authStore'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  accessToken: string
  expiresIn: number
  email: string
  fullName: string
  roles: string[]
}

export async function login(credentials: LoginRequest): Promise<void> {
  const response = await apiClient.post<LoginResponse>(
    '/api/v1/auth/login',
    credentials,
  )
  const { accessToken, email, fullName, roles } = response.data
  useAuthStore.getState().setAuth(accessToken, { email, fullName, roles })
}

export function logout(): void {
  useAuthStore.getState().clearAuth()
}
