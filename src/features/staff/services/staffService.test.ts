import { describe, it, expect, afterEach } from 'vitest'
import { captureRequests, restoreRequests } from '@/test/captureRequests'
import { staffService } from './staffService'

describe('staffService.create', () => {
  afterEach(() => restoreRequests())

  // QA-016: an empty hire date was sent as "" and failed DateOnly parsing
  it('leaves empty optional fields out of the request', async () => {
    const seen = captureRequests({ id: 's1' })

    await staffService.create({
      staffType: 'Dentist', firstName: 'Ana', lastName: 'Babić',
      email: '', phone: '', hireDate: '', specialty: '', colorHex: '#3B82F6',
    })

    const body = JSON.parse(seen[0].data)
    expect(body).toEqual({ staffType: 'Dentist', firstName: 'Ana', lastName: 'Babić', colorHex: '#3B82F6' })
  })
})

// People-merge plan 4.1: sign-in access lives on the staff profile
describe('staffService access', () => {
  afterEach(() => restoreRequests())

  it('sends access only when the person can sign in', async () => {
    const seen = captureRequests({ id: 's1' })

    await staffService.create({ staffType: 'Dentist', firstName: 'Ana', lastName: 'Babić', email: 'ana@x.ba' })
    await staffService.create({ staffType: 'Dentist', firstName: 'Ana', lastName: 'Babić', email: 'ana@x.ba', access: { role: 'Staff' } })

    expect(JSON.parse(seen[0].data)).not.toHaveProperty('access')
    expect(JSON.parse(seen[1].data).access).toEqual({ role: 'Staff' })
  })

  it('grants access to an existing profile', async () => {
    const seen = captureRequests({ userId: 'u1', tempPassword: 'Tmp-123' })

    const result = await staffService.grantAccess('s1', 'Staff')

    expect(seen[0].method).toBe('post')
    expect(seen[0].url).toBe('/api/v1/staff/s1/access')
    expect(JSON.parse(seen[0].data)).toEqual({ role: 'Staff' })
    expect(result.tempPassword).toBe('Tmp-123')
  })

  it('resets a password, changes a role and turns sign-in on or off through the account', async () => {
    const seen = captureRequests({ tempPassword: 'Tmp-456' })

    expect((await staffService.resetPassword('u1')).tempPassword).toBe('Tmp-456')
    await staffService.changeRole('u1', 'ClinicOwner')
    await staffService.setAccessActive('u1', false)

    expect(seen.map((r) => `${r.method} ${r.url}`)).toEqual([
      'post /api/v1/users/u1/reset-password',
      'put /api/v1/users/u1/role',
      'put /api/v1/users/u1/status',
    ])
    expect(JSON.parse(seen[1].data)).toEqual({ role: 'ClinicOwner' })
    expect(JSON.parse(seen[2].data)).toEqual({ isActive: false })
  })

  it('deactivates and reactivates a profile', async () => {
    const seen = captureRequests({ id: 's1' })

    await staffService.deactivate('s1')
    await staffService.reactivate('s1')

    expect(seen.map((r) => `${r.method} ${r.url}`)).toEqual([
      'post /api/v1/staff/s1/deactivate',
      'post /api/v1/staff/s1/reactivate',
    ])
  })
})
