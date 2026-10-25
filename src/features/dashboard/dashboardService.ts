import apiClient from '@/shared/api/client'

/** Operational figures, visible to every clinic role. */
export interface DashboardStatsResponse {
  newPatientsThisMonth: number
  appointmentsCompletedThisWeek: number
  appointmentsCompletedLastWeek: number
  recallDueSoon: number
  recallOverdue: number
}

/** Clinic-level money; the API serves it only to finance.view roles. */
export interface DashboardFinanceResponse {
  revenueThisMonth: number
  outstandingBalance: number
}

export const dashboardService = {
  getStats: (): Promise<DashboardStatsResponse> =>
    apiClient.get('/api/v1/dashboard/stats').then((r) => r.data),
  getFinance: (): Promise<DashboardFinanceResponse> =>
    apiClient.get('/api/v1/dashboard/finance').then((r) => r.data),
}
