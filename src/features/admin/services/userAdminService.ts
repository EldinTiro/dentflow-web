import apiClient from '@/shared/api/client'

export interface UserAdminResponse {
  id: string
  email: string
  fullName: string
  firstName: string
  lastName: string
  role: string | null
  tenantId: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface ListUsersResult {
  items: UserAdminResponse[]
  totalCount: number
  page: number
  pageSize: number
}

export const userAdminService = {
  list: (params?: {
    tenantId?: string
    role?: string
    searchTerm?: string
    page?: number
    pageSize?: number
  }) =>
    apiClient
      .get<ListUsersResult>('/api/v1/admin/users', { params })
      .then((r) => r.data),

  updateStatus: (id: string, isActive: boolean) =>
    apiClient
      .put(`/api/v1/admin/users/${id}/status`, { isActive })
      .then((r) => r.data),

  changeRole: (id: string, role: string) =>
    apiClient
      .put(`/api/v1/admin/users/${id}/role`, { role })
      .then((r) => r.data),

  resetPassword: (id: string) =>
    apiClient
      .post<{ tempPassword: string }>(`/api/v1/admin/users/${id}/reset-password`)
      .then((r) => r.data),

  provisionForTenant: (
    tenantId: string,
    body: { email: string; firstName: string; lastName: string; role: string },
  ) =>
    apiClient
      .post<{ userId: string; email: string; tempPassword: string }>(
        `/api/v1/admin/tenants/${tenantId}/users`,
        body,
      )
      .then((r) => r.data),
}
