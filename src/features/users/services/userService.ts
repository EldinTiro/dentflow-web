import apiClient from '@/shared/api/client'

export interface TenantUserResponse {
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
  items: TenantUserResponse[]
  totalCount: number
  page: number
  pageSize: number
}

export interface InviteUserResult {
  userId: string
  email: string
  tempPassword: string
}

export const userService = {
  list: (params?: { search?: string; page?: number; pageSize?: number }) =>
    apiClient
      .get<ListUsersResult>('/api/v1/users', { params })
      .then((r) => r.data),

  invite: (body: { email: string; firstName: string; lastName: string; role: string }) =>
    apiClient
      .post<InviteUserResult>('/api/v1/users/invite', body)
      .then((r) => r.data),

  changeRole: (id: string, role: string) =>
    apiClient
      .put(`/api/v1/users/${id}/role`, { role })
      .then((r) => r.data),

  updateStatus: (id: string, isActive: boolean) =>
    apiClient
      .put(`/api/v1/users/${id}/status`, { isActive })
      .then((r) => r.data),
}
