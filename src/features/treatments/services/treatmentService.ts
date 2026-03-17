import apiClient from '@/shared/api/client'

export type TreatmentPlanStatus = 'Draft' | 'Active' | 'Completed' | 'Declined'
export type TreatmentPlanItemStatus = 'Planned' | 'Accepted' | 'Completed' | 'Declined'

export const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  Draft: 'Draft',
  Active: 'Active',
  Completed: 'Completed',
  Declined: 'Declined',
}

export const PLAN_STATUS_COLORS: Record<TreatmentPlanStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Active: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-600',
}

export const ITEM_STATUS_LABELS: Record<TreatmentPlanItemStatus, string> = {
  Planned: 'Planned',
  Accepted: 'Accepted',
  Completed: 'Completed',
  Declined: 'Declined',
}

export const ITEM_STATUS_COLORS: Record<TreatmentPlanItemStatus, string> = {
  Planned: 'bg-gray-100 text-gray-600',
  Accepted: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-600',
}

export const ALL_PLAN_STATUSES: TreatmentPlanStatus[] = ['Draft', 'Active', 'Completed', 'Declined']
export const ALL_ITEM_STATUSES: TreatmentPlanItemStatus[] = ['Planned', 'Accepted', 'Completed', 'Declined']

export interface TreatmentPlanItemResponse {
  id: string
  treatmentPlanId: string
  toothNumber: number | null
  surface: string | null
  cdtCode: string | null
  description: string
  fee: number
  status: TreatmentPlanItemStatus
  createdAt: string
  updatedAt: string | null
}

export interface TreatmentPlanResponse {
  id: string
  patientId: string
  title: string
  notes: string | null
  status: TreatmentPlanStatus
  items: TreatmentPlanItemResponse[]
  totalFee: number
  createdAt: string
  updatedAt: string | null
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

export interface CreateTreatmentPlanRequest {
  title: string
  notes?: string | null
}

export interface UpdateTreatmentPlanRequest {
  title: string
  notes?: string | null
  status: TreatmentPlanStatus
}

export interface AddTreatmentPlanItemRequest {
  toothNumber?: number | null
  surface?: string | null
  cdtCode?: string | null
  description: string
  fee: number
  status: TreatmentPlanItemStatus
}

export interface UpdateTreatmentPlanItemRequest {
  toothNumber?: number | null
  surface?: string | null
  cdtCode?: string | null
  description: string
  fee: number
  status: TreatmentPlanItemStatus
}

export const treatmentService = {
  list: (patientId: string, params?: { status?: TreatmentPlanStatus; page?: number; pageSize?: number }) =>
    apiClient
      .get<PagedResult<TreatmentPlanResponse>>(`/api/v1/patients/${patientId}/treatment-plans`, { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient
      .get<TreatmentPlanResponse>(`/api/v1/treatment-plans/${id}`)
      .then((r) => r.data),

  create: (patientId: string, body: CreateTreatmentPlanRequest) =>
    apiClient
      .post<TreatmentPlanResponse>(`/api/v1/patients/${patientId}/treatment-plans`, body)
      .then((r) => r.data),

  update: (id: string, body: UpdateTreatmentPlanRequest) =>
    apiClient
      .put<TreatmentPlanResponse>(`/api/v1/treatment-plans/${id}`, body)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/api/v1/treatment-plans/${id}`).then((r) => r.data),

  addItem: (planId: string, body: AddTreatmentPlanItemRequest) =>
    apiClient
      .post<TreatmentPlanItemResponse>(`/api/v1/treatment-plans/${planId}/items`, body)
      .then((r) => r.data),

  updateItem: (planId: string, itemId: string, body: UpdateTreatmentPlanItemRequest) =>
    apiClient
      .put<TreatmentPlanItemResponse>(`/api/v1/treatment-plans/${planId}/items/${itemId}`, body)
      .then((r) => r.data),

  deleteItem: (planId: string, itemId: string) =>
    apiClient
      .delete(`/api/v1/treatment-plans/${planId}/items/${itemId}`)
      .then((r) => r.data),
}
