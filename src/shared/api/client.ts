import axios from 'axios'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/store/authStore'

const apiClient = axios.create({
  // Always use relative URLs — Vite proxies /api in dev, nginx proxies /api in prod.
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['Accept-Language'] = i18n.language || 'en'
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
