import { describe, it, expect } from 'vitest'
import { getApiErrorCodes } from './apiError'

function problem(errors: Array<{ name: string; reason: string }>, status = 409) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, errors } },
  })
}

describe('getApiErrorCodes', () => {
  // The API camel-cases the first letter of each name ("patient.HasUpcomingAppointments")
  it('maps codes case-insensitively to their reasons, metadata included', () => {
    const codes = getApiErrorCodes(problem([
      { name: 'patient.HasUpcomingAppointments', reason: 'This patient has 2 upcoming appointment(s).' },
      { name: 'patient.HasUpcomingAppointments.count', reason: '2' },
    ]))

    expect(codes.has('Patient.HasUpcomingAppointments')).toBe(true)
    expect(codes.get('Patient.HasUpcomingAppointments.count')).toBe('2')
  })

  it('is empty for anything that is not an API error', () => {
    expect(getApiErrorCodes(new Error('network')).size).toBe(0)
    expect(getApiErrorCodes(undefined).has('x')).toBe(false)
  })
})
