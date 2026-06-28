import apiClient from '@/shared/api/client'

export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay'
export type ContactMethod = 'Email' | 'Phone' | 'Sms'
export type PatientStatus = 'Active' | 'Inactive' | 'Transferred'

export interface PatientResponse {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
  preferredName: string | null
  parentName: string | null
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
  patientNumber?: string | null
  firstName: string
  lastName: string
  preferredName?: string | null
  parentName?: string | null
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
  parentName?: string | null
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

export interface PatientSearchResult {
  id: string
  patientNumber: string
  fullName: string
  phoneMobile: string | null
  email: string | null
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string | null
  phonePrimary: string | null
  isPrimary: boolean
}

export interface Allergy {
  id: string
  allergen: string
  reaction: string | null
  severity: string | null
  notes: string | null
  reportedAt: string | null
}

export interface MedicalHistory {
  id: string
  bloodType: string | null
  isPregnant: boolean | null
  isSmoker: boolean
  isDiabetic: boolean
  hasHeartCondition: boolean
  hasHypertension: boolean
  hasBleedingDisorder: boolean
  isOnBloodThinners: boolean
  hasPacemaker: boolean
  hasArtificialJoints: boolean
  hasLatexAllergy: boolean
  generalNotes: string | null
  currentMedications: string | null
  physicianName: string | null
  physicianPhone: string | null
  recordedAt: string
}

export interface UpsertMedicalHistoryRequest {
  bloodType?: string | null
  isPregnant?: boolean | null
  isSmoker: boolean
  isDiabetic: boolean
  hasHeartCondition: boolean
  hasHypertension: boolean
  hasBleedingDisorder: boolean
  isOnBloodThinners: boolean
  hasPacemaker: boolean
  hasArtificialJoints: boolean
  hasLatexAllergy: boolean
  generalNotes?: string | null
  currentMedications?: string | null
  physicianName?: string | null
  physicianPhone?: string | null
}

export interface AddEmergencyContactRequest {
  name: string
  relationship?: string | null
  phonePrimary?: string | null
  isPrimary: boolean
}

export interface AddAllergyRequest {
  allergen: string
  reaction?: string | null
  severity?: string | null
  notes?: string | null
}

export const patientService = {
  search: (q: string, limit = 20) =>
    apiClient
      .get<PatientSearchResult[]>('/api/v1/patients/search', { params: { q, limit } })
      .then((r) => r.data),

  list: (params?: {
    search?: string
    status?: PatientStatus
    recallFilter?: 'overdue' | 'due-soon'
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

  // Emergency contacts
  listEmergencyContacts: (patientId: string) =>
    apiClient
      .get<EmergencyContact[]>(`/api/v1/patients/${patientId}/emergency-contacts`)
      .then((r) => r.data),

  addEmergencyContact: (patientId: string, body: AddEmergencyContactRequest) =>
    apiClient
      .post<EmergencyContact>(`/api/v1/patients/${patientId}/emergency-contacts`, body)
      .then((r) => r.data),

  deleteEmergencyContact: (patientId: string, contactId: string) =>
    apiClient
      .delete(`/api/v1/patients/${patientId}/emergency-contacts/${contactId}`)
      .then((r) => r.data),

  // Allergies
  listAllergies: (patientId: string) =>
    apiClient
      .get<Allergy[]>(`/api/v1/patients/${patientId}/allergies`)
      .then((r) => r.data),

  addAllergy: (patientId: string, body: AddAllergyRequest) =>
    apiClient
      .post<Allergy>(`/api/v1/patients/${patientId}/allergies`, body)
      .then((r) => r.data),

  deleteAllergy: (patientId: string, allergyId: string) =>
    apiClient
      .delete(`/api/v1/patients/${patientId}/allergies/${allergyId}`)
      .then((r) => r.data),

  // Medical history
  getMedicalHistory: (patientId: string) =>
    apiClient
      .get<MedicalHistory | null>(`/api/v1/patients/${patientId}/medical-history`)
      .then((r) => r.data)
      .catch(() => null),

  upsertMedicalHistory: (patientId: string, body: UpsertMedicalHistoryRequest) =>
    apiClient
      .put<MedicalHistory>(`/api/v1/patients/${patientId}/medical-history`, body)
      .then((r) => r.data),
}
