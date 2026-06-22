import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tenantService } from '@/features/admin/services/tenantService'

interface FeatureContextValue {
  flags: ReadonlySet<string>
  quotas: Readonly<Record<string, number>>
  plan: string
  isLoaded: boolean
}

const FeatureContext = createContext<FeatureContextValue>({
  flags: new Set(),
  quotas: {},
  plan: 'Free',
  isLoaded: false,
})

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { data, isSuccess } = useQuery({
    queryKey: ['tenant', 'features'],
    queryFn: () => tenantService.getFeatures(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const value: FeatureContextValue = {
    flags: new Set(data?.flags ?? []),
    quotas: data?.quotas ?? {},
    plan: data?.plan ?? 'Free',
    isLoaded: isSuccess,
  }

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
}

export function useFeatureFlags() {
  return useContext(FeatureContext)
}

/** Returns true if the given feature flag is enabled for the current tenant. */
export function useFeatureFlag(flag: string): boolean {
  const { flags } = useContext(FeatureContext)
  return flags.has(flag)
}

/** Returns the quota value for the given quota key. -1 means unlimited. */
export function useQuota(quota: string): number {
  const { quotas } = useContext(FeatureContext)
  return quotas[quota] ?? 0
}
