import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import apiClient from '@/shared/api/client'

const originalAdapter = apiClient.defaults.adapter

/** Routes apiClient requests to an in-memory adapter and records them. Call restoreRequests() after. */
export function captureRequests(data: unknown = {}) {
  const seen: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  apiClient.defaults.adapter = adapter
  return seen
}

export function restoreRequests() {
  apiClient.defaults.adapter = originalAdapter
}
