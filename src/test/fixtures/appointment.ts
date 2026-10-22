import type { AppointmentResponse } from '@/features/appointments/services/appointmentService'

export function appointmentFixture(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appt-1', patientId: 'pat-1', providerId: 'prov-1', operatoryId: null, appointmentTypeId: 'type-1',
    status: 'Scheduled', startAt: '2026-10-22T08:00:00Z', endAt: '2026-10-22T08:30:00Z', durationMinutes: 30,
    isNewPatient: false, chiefComplaint: null, notes: null, cancellationReason: null, cancelledAt: null,
    confirmedAt: null, checkedInAt: null, startedAt: null, completedAt: null, source: 'Staff', colorHex: null,
    createdAt: '2026-10-20T08:00:00Z', updatedAt: null,
    ...overrides,
  }
}
