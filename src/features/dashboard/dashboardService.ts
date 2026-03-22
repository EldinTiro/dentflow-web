import apiClient from '@/shared/api/client'

export interface DashboardStatsResponse {
  revenueThisMonth: number
  outstandingBalance: number
  newPatientsThisMonth: number
  appointmentsCompletedThisWeek: number
  appointmentsCompletedLastWeek: number
  recallDueSoon: number
  recallOverdue: number
}

export const dashboardService = {
  getStats: (): Promise<DashboardStatsResponse> =>
    apiClient.get('/api/v1/dashboard/stats').then((r) => r.data),
}
