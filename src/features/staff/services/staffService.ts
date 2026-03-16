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
};
