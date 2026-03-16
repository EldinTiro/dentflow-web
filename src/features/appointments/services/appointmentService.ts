import apiClient from '@/shared/api/client';

export type AppointmentStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'CheckedIn'
  | 'InChair'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow'
  | 'Rescheduled';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  Scheduled: 'Scheduled',
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked In',
  InChair: 'In Chair',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'No Show',
  Rescheduled: 'Rescheduled',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Confirmed: 'bg-green-100 text-green-700',
  CheckedIn: 'bg-yellow-100 text-yellow-700',
  InChair: 'bg-orange-100 text-orange-700',
  Completed: 'bg-gray-100 text-gray-600',
  Cancelled: 'bg-red-100 text-red-600',
  NoShow: 'bg-red-50 text-red-400',
  Rescheduled: 'bg-purple-100 text-purple-700',
};

export const ALL_STATUSES: AppointmentStatus[] = [
  'Scheduled',
  'Confirmed',
  'CheckedIn',
  'InChair',
  'Completed',
  'Cancelled',
  'NoShow',
  'Rescheduled',
];

export interface AppointmentResponse {
  id: string;
  patientId: string;
  providerId: string;
  operatoryId: string | null;
  appointmentTypeId: string;
  status: AppointmentStatus;
  startAt: string; // ISO datetime
  endAt: string;
  durationMinutes: number;
  isNewPatient: boolean;
  chiefComplaint: string | null;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  source: string;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AppointmentTypeResponse {
  id: string;
  name: string;
  description: string | null;
  defaultDurationMinutes: number;
  colorHex: string | null;
  isBookableOnline: boolean;
  requiresNewPatientForm: boolean;
  sortOrder: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ListAppointmentsParams {
  patientId?: string;
  providerId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  status?: AppointmentStatus;
  page?: number;
  pageSize?: number;
}

export interface BookAppointmentRequest {
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  startAt: string; // ISO datetime
  endAt: string;
  chiefComplaint?: string;
  notes?: string;
  operatoryId?: string;
  isNewPatient?: boolean;
  source?: string;
}

export interface RescheduleRequest {
  newStartAt: string;
  newEndAt: string;
}

const BASE = '/api/v1/appointments';

export const appointmentService = {
  list(params?: ListAppointmentsParams) {
    return apiClient
      .get<PagedResult<AppointmentResponse>>(BASE, { params })
      .then((r) => r.data);
  },

  getById(id: string) {
    return apiClient
      .get<AppointmentResponse>(`${BASE}/${id}`)
      .then((r) => r.data);
  },

  book(body: BookAppointmentRequest) {
    return apiClient
      .post<AppointmentResponse>(BASE, body)
      .then((r) => r.data);
  },

  reschedule(id: string, body: RescheduleRequest) {
    return apiClient
      .put<AppointmentResponse>(`${BASE}/${id}/reschedule`, body)
      .then((r) => r.data);
  },

  updateStatus(id: string, newStatus: AppointmentStatus) {
    return apiClient
      .put<AppointmentResponse>(`${BASE}/${id}/status`, { newStatus })
      .then((r) => r.data);
  },

  cancel(id: string, reason?: string) {
    return apiClient
      .put<AppointmentResponse>(`${BASE}/${id}/cancel`, { reason })
      .then((r) => r.data);
  },

  listTypes() {
    return apiClient
      .get<AppointmentTypeResponse[]>('/api/v1/appointment-types')
      .then((r) => r.data);
  },
};
