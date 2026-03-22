import apiClient from '@/shared/api/client'

export type DocumentCategory = 'XRay' | 'Photo' | 'Consent' | 'Insurance' | 'Other'

export interface PatientDocumentResponse {
  id: string
  patientId: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  category: DocumentCategory
  notes: string | null
  uploadedByUserId: string
  createdAt: string
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  XRay: 'X-Ray',
  Photo: 'Photo',
  Consent: 'Consent Form',
  Insurance: 'Insurance',
  Other: 'Other',
}

export const documentService = {
  list(patientId: string): Promise<PatientDocumentResponse[]> {
    return apiClient.get(`/api/v1/patients/${patientId}/documents`).then(r => r.data)
  },

  upload(
    patientId: string,
    file: File,
    category: DocumentCategory,
    notes?: string
  ): Promise<PatientDocumentResponse> {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    if (notes) form.append('notes', notes)
    return apiClient
      .post(`/api/v1/patients/${patientId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  delete(patientId: string, documentId: string): Promise<void> {
    return apiClient.delete(`/api/v1/patients/${patientId}/documents/${documentId}`)
  },

  getUrl(patientId: string, documentId: string): Promise<string> {
    return apiClient
      .get(`/api/v1/patients/${patientId}/documents/${documentId}/url`)
      .then(r => r.data.url)
  },
}
