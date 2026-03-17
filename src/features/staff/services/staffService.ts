import apiClient from '@/shared/api/client';

export type StaffType =
  | 'Dentist'
  | 'DentalAssistant'
  | 'Hygienist'
  | 'Receptionist'
  | 'ClinicAdmin'
  | 'OfficeManager';

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  Dentist: 'Dentist',
  DentalAssistant: 'Dental Assistant',
  Hygienist: 'Hygienist',
  Receptionist: 'Receptionist',
  ClinicAdmin: 'Clinic Admin',
  OfficeManager: 'Office Manager',
};

export const ALL_STAFF_TYPES: StaffType[] = [
  'Dentist',
  'DentalAssistant',
  'Hygienist',
  'Receptionist',
  'ClinicAdmin',
  'OfficeManager',
];

export interface StaffMemberResponse {
  id: string;
  staffType: StaffType;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  colorHex: string | null;
  biography: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null; // ISO date string
  npiNumber: string | null;
  isActive: boolean;
  hireDate: string | null; // ISO date string
  terminationDate: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ListStaffParams {
  searchTerm?: string;
  staffType?: StaffType;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateStaffRequest {
  staffType: StaffType;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  specialty?: string;
  colorHex?: string;
}

export interface UpdateStaffRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialty?: string;
  colorHex?: string;
  biography?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  npiNumber?: string;
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  Sunday: 'Sunday',
  Monday: 'Monday',
  Tuesday: 'Tuesday',
  Wednesday: 'Wednesday',
  Thursday: 'Thursday',
  Friday: 'Friday',
  Saturday: 'Saturday',
};
export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// C# DayOfWeek enum values (0=Sunday, 1=Monday … 6=Saturday)
export const DAY_OF_WEEK_VALUE: Record<DayOfWeek, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
export const DAY_OF_WEEK_FROM_VALUE: Record<number, DayOfWeek> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

export interface StaffAvailabilityResponse {
  id: string;
  staffMemberId: string;
  dayOfWeek: number; // C# DayOfWeek enum: 0=Sunday … 6=Saturday
  startTime: string; // "HH:mm:ss"
  endTime: string;   // "HH:mm:ss"
  effectiveFrom: string; // ISO date "YYYY-MM-DD"
  effectiveTo: string | null;
}

export interface SetAvailabilityRequest {
  dayOfWeek: number;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface StaffBlockedTimeResponse {
  id: string;
  staffMemberId: string;
  startAt: string; // ISO datetime
  endAt: string;
  reason: string | null;
  notes: string | null;
}

export interface AddBlockedTimeRequest {
  startAt: string; // ISO datetime UTC
  endAt: string;
  reason?: string;
  notes?: string;
}

const BASE = '/api/v1/staff';

export const staffService = {
  list(params?: ListStaffParams) {
    return apiClient
      .get<PagedResult<StaffMemberResponse>>(BASE, { params })
      .then((r) => r.data);
  },

  getById(id: string) {
    return apiClient
      .get<StaffMemberResponse>(`${BASE}/${id}`)
      .then((r) => r.data);
  },

  create(body: CreateStaffRequest) {
    return apiClient
      .post<StaffMemberResponse>(BASE, body)
      .then((r) => r.data);
  },

  update(id: string, body: UpdateStaffRequest) {
    return apiClient
      .put<StaffMemberResponse>(`${BASE}/${id}`, body)
      .then((r) => r.data);
  },

  delete(id: string) {
    return apiClient.delete(`${BASE}/${id}`);
  },

  // Availability
  getAvailability(staffId: string) {
    return apiClient
      .get<StaffAvailabilityResponse[]>(`${BASE}/${staffId}/availability`)
      .then((r) => r.data);
  },

  setAvailability(staffId: string, body: SetAvailabilityRequest) {
    return apiClient
      .post<StaffAvailabilityResponse>(`${BASE}/${staffId}/availability`, body)
      .then((r) => r.data);
  },

  deleteAvailability(staffId: string, availabilityId: string) {
    return apiClient.delete(`${BASE}/${staffId}/availability/${availabilityId}`);
  },

  // Blocked Times
  listBlockedTimes(staffId: string, params?: { from?: string; to?: string }) {
    return apiClient
      .get<StaffBlockedTimeResponse[]>(`${BASE}/${staffId}/blocked-times`, { params })
      .then((r) => r.data);
  },

  addBlockedTime(staffId: string, body: AddBlockedTimeRequest) {
    return apiClient
      .post<StaffBlockedTimeResponse>(`${BASE}/${staffId}/blocked-times`, body)
      .then((r) => r.data);
  },

  deleteBlockedTime(staffId: string, blockedTimeId: string) {
    return apiClient.delete(`${BASE}/${staffId}/blocked-times/${blockedTimeId}`);
  },
};
