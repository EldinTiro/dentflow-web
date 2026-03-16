import apiClient from '@/shared/api/client'

export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay'
export type ContactMethod = 'Email' | 'Phone' | 'Sms'
export type PatientStatus = 'Active' | 'Inactive' | 'Archived' | 'Deceased'

export interface PatientResponse {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
  preferredName: string | null
  fullName: string
  displayName: string
  dateOfBirth: string | null
  gender: Gender | null
  email: string | null
  phoneMobile: string | null
  phoneHome: string | null
  phoneWork: string | null
  preferredContactMethod: ContactMethod | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  stateProvince: string | null
  postalCode: string | null
  countryCode: string | null
  status: PatientStatus
  firstVisitDate: string | null
  lastVisitDate: string | null
  recallDueDate: string | null
  preferredProviderId: string | null
  smsOptIn: boolean
  emailOptIn: boolean
  notes: string | null
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

export interface CreatePatientRequest {
  firstName: string
  lastName: string
  preferredName?: string | null
  dateOfBirth?: string | null
  gender?: Gender | null
  email?: string | null
  phoneMobile?: string | null
  phoneHome?: string | null
  phoneWork?: string | null
  preferredContactMethod?: ContactMethod | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  stateProvince?: string | null
  postalCode?: string | null
  countryCode?: string | null
  occupation?: string | null
  preferredProviderId?: string | null
  smsOptIn: boolean
  emailOptIn: boolean
  referredBySource?: string | null
  notes?: string | null
}

export interface UpdatePatientRequest {
  firstName: string
  lastName: string
  preferredName?: string | null
  dateOfBirth?: string | null
  gender?: Gender | null
  pronouns?: string | null
  email?: string | null
  phoneMobile?: string | null
  phoneHome?: string | null
  phoneWork?: string | null
  preferredContactMethod?: ContactMethod | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  stateProvince?: string | null
  postalCode?: string | null
  countryCode?: string | null
  occupation?: string | null
  preferredProviderId?: string | null
  smsOptIn: boolean
  emailOptIn: boolean
  notes?: string | null
}

export const patientService = {
  list: (params?: {
    search?: string
    status?: PatientStatus
    page?: number
    pageSize?: number
  }) =>
    apiClient
      .get<PagedResult<PatientResponse>>('/api/v1/patients', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient
      .get<PatientResponse>(`/api/v1/patients/${id}`)
      .then((r) => r.data),

  create: (body: CreatePatientRequest) =>
    apiClient
      .post<PatientResponse>('/api/v1/patients', body)
      .then((r) => r.data),

  update: (id: string, body: UpdatePatientRequest) =>
    apiClient
      .put<PatientResponse>(`/api/v1/patients/${id}`, body)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete(`/api/v1/patients/${id}`)
      .then((r) => r.data),
}
