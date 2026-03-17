import type { AxiosError } from 'axios';

// FastEndpoints default error shape:
// { statusCode: number; errors: Array<{ name: string; reason: string }> }
// AddError(message) → { name: "generalErrors", reason: <message> }
interface FastEndpointsErrorBody {
  statusCode?: number;
  errors?: Array<{ name?: string; reason?: string }>;
}

/**
 * Safety-net map: if the backend accidentally sends an error code instead of a
 * human-readable description, this converts it to a friendly message.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  'Appointment.ProviderUnavailable':
    'This provider has a scheduled leave or block during the selected time. Please choose a different date or another provider.',
  'Appointment.ProviderConflict':
    'This provider already has an appointment during this time slot. Please select a different time.',
  'Appointment.NotFound': 'Appointment not found.',
  'Appointment.InvalidTimeRange': 'End time must be after start time.',
  'Appointment.CannotCancelCompleted': 'A completed appointment cannot be cancelled.',
  'AppointmentType.NotFound': 'The selected appointment type was not found.',
};

function resolveMessage(value: string | undefined): string | null {
  if (!value || value === 'generalErrors') return null;
  // If it's a known error code, return the friendly copy
  if (Object.prototype.hasOwnProperty.call(ERROR_CODE_MESSAGES, value)) {
    return ERROR_CODE_MESSAGES[value];
  }
  // If it looks like a machine code (PascalCase.PascalCase, no spaces), skip it
  if (/^[A-Za-z]+\.[A-Za-z]/.test(value) && !value.includes(' ')) return null;
  return value;
}

/**
 * Extracts the first human-readable error message from a FastEndpoints 4xx response.
 * Falls back to `fallback` when the response body doesn't match the expected shape.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred. Please try again.',
): string {
  const axiosErr = err as AxiosError<FastEndpointsErrorBody>;
  const apiErrors = axiosErr?.response?.data?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) {
    for (const e of apiErrors) {
      // reason carries the message; name is always "generalErrors"
      const msg = resolveMessage(e.reason) ?? resolveMessage(e.name);
      if (msg) return msg;
    }
  }
  return fallback;
}
