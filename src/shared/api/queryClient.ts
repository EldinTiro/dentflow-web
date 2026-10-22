import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

/**
 * Retry once for network/server failures only. A 4xx will not change on retry, and
 * retrying it doubled every 403/404 request (QA-033).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 1
}

/**
 * Lives outside the React tree so non-component code — signing out, for one —
 * can drop cached data without needing a hook.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: shouldRetry,
    },
  },
})
