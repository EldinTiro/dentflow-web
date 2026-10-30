import apiClient from '@/shared/api/client'

/** One finding on one tooth (FDI number). */
export interface ToothFinding {
  id: string
  tooth: number
  condition: string
  /** Letters from M, O, D, B, L — caries and fillings only. */
  surfaces: string | null
  notes: string | null
  recordedAt: string
}

export interface AddToothFindingRequest {
  tooth: number
  condition: string
  surfaces?: string | null
  notes?: string | null
}

export const toothChartService = {
  list: (patientId: string) =>
    apiClient.get<ToothFinding[]>(`/api/v1/patients/${patientId}/teeth`).then((r) => r.data),

  add: (patientId: string, body: AddToothFindingRequest) =>
    apiClient.post<ToothFinding>(`/api/v1/patients/${patientId}/teeth`, body).then((r) => r.data),

  remove: (patientId: string, findingId: string) =>
    apiClient.delete(`/api/v1/patients/${patientId}/teeth/${findingId}`).then((r) => r.data),
}
