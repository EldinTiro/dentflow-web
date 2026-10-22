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
