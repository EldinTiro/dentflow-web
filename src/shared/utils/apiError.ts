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
  return getApiErrorMessages(err)[0] ?? fallback;
}

/**
 * Every human-readable message of a FastEndpoints error. Error metadata travels as extra
 * entries named "<code>.<key>" (e.g. "….count" → "6"); those are data, never shown (DT-26).
 */
export function getApiErrorMessages(err: unknown): string[] {
  const apiErrors = (err as AxiosError<FastEndpointsErrorBody> | undefined)?.response?.data?.errors;
  if (!Array.isArray(apiErrors)) return [];
  const names = new Set(apiErrors.map((e) => e.name?.toLowerCase()).filter(Boolean));
  const isMetadata = (name?: string) => {
    const i = name?.lastIndexOf('.') ?? -1;
    return i > 0 && names.has(name!.slice(0, i).toLowerCase());
  };
  return apiErrors
    .filter((e) => !isMetadata(e.name))
    // reason carries the message; name is the code (or "generalErrors")
    .map((e) => resolveMessage(e.reason) ?? resolveMessage(e.name))
    .filter((m): m is string => !!m);
}

/** Error codes the API returned, matched case-insensitively. */
export interface ApiErrorCodes {
  has(code: string): boolean
  get(code: string): string | undefined
  readonly size: number
}

/**
 * Every `{ name, reason }` from a FastEndpoints error as a lookup by code. The API sends
 * names camel-cased ("patient.HasUpcomingAppointments") and error metadata as extra
 * entries ("….count" → "2"), so lookups ignore case.
 */
export function getApiErrorCodes(err: unknown): ApiErrorCodes {
  const apiErrors = (err as AxiosError<FastEndpointsErrorBody> | undefined)?.response?.data?.errors
  const map = new Map<string, string>()
  if (Array.isArray(apiErrors)) {
    for (const e of apiErrors) if (e.name) map.set(e.name.toLowerCase(), e.reason ?? '')
  }
  return {
    has: (code) => map.has(code.toLowerCase()),
    get: (code) => map.get(code.toLowerCase()),
    size: map.size,
  }
}
