import { QueryClient } from '@tanstack/react-query'

/**
 * Lives outside the React tree so non-component code — signing out, for one —
 * can drop cached data without needing a hook.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})
