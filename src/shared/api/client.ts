import axios from 'axios'
import { useAuthStore } from '@/features/auth/store/authStore'

const apiClient = axios.create({
  // In dev, Vite proxies /api → backend (no CORS needed).
  // In production, VITE_API_URL is the full backend URL.
  baseURL: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? ''),
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
    }
    return Promise.reject(error)
  },
)

export default apiClient
