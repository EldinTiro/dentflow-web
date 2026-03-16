import apiClient from '@/shared/api/client'

export interface RoleCount {
  role: string
  count: number
}

export interface PlanCount {
  plan: string
  count: number
}

export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  inactiveTenants: number
  totalUsers: number
  usersByRole: RoleCount[]
  planDistribution: PlanCount[]
}

export const statsService = {
  getPlatformStats: () =>
    apiClient.get<PlatformStats>('/api/v1/admin/stats').then((r) => r.data),
}
