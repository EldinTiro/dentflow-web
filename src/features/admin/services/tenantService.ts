import apiClient from '@/shared/api/client'

export interface TenantResponse {
  id: string
  slug: string
  name: string
  plan: string
  planExpiresAt: string | null
  isActive: boolean
  createdAt: string
}

export interface TenantCreatedResponse extends TenantResponse {
  ownerEmail: string
  tempPassword: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface CreateTenantRequest {
  slug: string
  name: string
  plan: string
  ownerEmail: string
  ownerFirstName: string
  ownerLastName: string
}

export interface UpdateTenantRequest {
  name: string
}

export interface UpdateTenantPlanRequest {
  plan: string
  expiresAt?: string | null
}

export const tenantService = {
  list: (params?: {
    searchTerm?: string
    isActive?: boolean
    page?: number
    pageSize?: number
  }) =>
    apiClient
      .get<PagedResult<TenantResponse>>('/api/v1/tenants', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<TenantResponse>(`/api/v1/tenants/${id}`).then((r) => r.data),

  create: (body: CreateTenantRequest) =>
    apiClient
      .post<TenantCreatedResponse>('/api/v1/tenants', body)
      .then((r) => r.data),

  update: (id: string, body: UpdateTenantRequest) =>
    apiClient
      .put<TenantResponse>(`/api/v1/tenants/${id}`, body)
      .then((r) => r.data),

  activate: (id: string) =>
    apiClient.post(`/api/v1/tenants/${id}/activate`).then((r) => r.data),

  deactivate: (id: string) =>
    apiClient.delete(`/api/v1/tenants/${id}`).then((r) => r.data),

  updatePlan: (id: string, body: UpdateTenantPlanRequest) =>
    apiClient
      .put<TenantResponse>(`/api/v1/tenants/${id}/plan`, body)
      .then((r) => r.data),
}
