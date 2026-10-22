import apiClient from '@/shared/api/client';
import { localDayStartUtc, localDayEndUtc } from '@/shared/lib/dates';

export type AppointmentStatus =
  | 'Scheduled'
  | 'CheckedIn'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  Scheduled:  'Scheduled',
  CheckedIn:  'Checked In',
  InProgress: 'In Progress',
  Completed:  'Completed',
  Cancelled:  'Cancelled',
  NoShow:     'No Show',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Scheduled:  'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
  CheckedIn:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300',
  Completed:  'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
  Cancelled:  'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300',
  NoShow:     'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-400/10 dark:text-red-300',
};

export const ALL_STATUSES: AppointmentStatus[] = [
  'Scheduled',
  'CheckedIn',
  'InProgress',
  'Completed',
  'Cancelled',
  'NoShow',
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
  startedAt: string | null;
  completedAt: string | null;
  source: string;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** Filled by the list endpoint (QA-033). */
  patientName?: string | null;
}

export interface AppointmentStatusHistoryResponse {
  id: string;
  appointmentId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string | null;
  reason: string | null;
  isOverride: boolean;
  changedAt: string;
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
  defaultFee: number | null;
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
  dateFrom?: string; // local calendar date, YYYY-MM-DD — sent as the UTC start of that day
  dateTo?: string;   // local calendar date, YYYY-MM-DD — sent as the UTC end of that day
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

export interface TimeSlot {
  startAt: string;
  endAt: string;
}

export const appointmentService = {
  getAvailableSlots(providerId: string, date: string, duration: number) {
    return apiClient
      .get<TimeSlot[]>(`/api/v1/staff/${providerId}/slots`, { params: { date, duration } })
      .then((r) => r.data);
  },

  list(params?: ListAppointmentsParams) {
    // The API compares instants; a bare date would be read as the UTC day (QA-008).
    const query = params && {
      ...params,
      dateFrom: params.dateFrom ? localDayStartUtc(params.dateFrom) : undefined,
      dateTo: params.dateTo ? localDayEndUtc(params.dateTo) : undefined,
    };
    return apiClient
      .get<PagedResult<AppointmentResponse>>(BASE, { params: query })
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
      .patch<AppointmentResponse>(`${BASE}/${id}/status`, { status: newStatus })
      .then((r) => r.data);
  },

  cancel(id: string, reason?: string) {
    return apiClient
      .post<AppointmentResponse>(`${BASE}/${id}/cancel`, { reason })
      .then((r) => r.data);
  },

  overrideStatus(id: string, newStatus: AppointmentStatus, reason?: string) {
    return apiClient
      .post<AppointmentResponse>(`${BASE}/${id}/override-status`, { newStatus, reason })
      .then((r) => r.data);
  },

  updateNotes(id: string, notes: string | null) {
    return apiClient
      .patch<AppointmentResponse>(`${BASE}/${id}/notes`, { notes })
      .then((r) => r.data);
  },

  getHistory(id: string) {
    return apiClient
      .get<AppointmentStatusHistoryResponse[]>(`${BASE}/${id}/history`)
      .then((r) => r.data);
  },

  listTypes() {
    return apiClient
      .get<AppointmentTypeResponse[]>('/api/v1/appointment-types')
      .then((r) => r.data);
  },

  createType(body: { name: string; defaultDurationMinutes: number; description?: string; colorHex?: string; isBookableOnline?: boolean; defaultFee?: number | null }) {
    return apiClient
      .post<AppointmentTypeResponse>('/api/v1/appointment-types', body)
      .then((r) => r.data);
  },

  updateType(id: string, body: { name: string; defaultDurationMinutes: number; description?: string; colorHex?: string; isBookableOnline?: boolean; defaultFee?: number | null }) {
    return apiClient
      .put<AppointmentTypeResponse>(`/api/v1/appointment-types/${id}`, body)
      .then((r) => r.data);
  },

  deleteType(id: string) {
    return apiClient
      .delete(`/api/v1/appointment-types/${id}`)
      .then((r) => r.data);
  },
};
