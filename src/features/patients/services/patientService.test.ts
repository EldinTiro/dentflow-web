import { describe, it, expect, afterEach } from 'vitest'
import { captureRequests, restoreRequests } from '@/test/captureRequests'
import { patientService } from './patientService'

describe('patientService card', () => {
  afterEach(() => restoreRequests())

  // Client request 2026-11-10: the card is opened at the first visit
  it('opens a card with the given number, or the next one when none is given', async () => {
    const seen = captureRequests({ patientNumber: '4252' })

    await patientService.openCard('p1', null)
    await patientService.openCard('p1', '4377')

    expect(seen.map((r) => `${r.method} ${r.url}`)).toEqual(['post /api/v1/patients/p1/card', 'post /api/v1/patients/p1/card'])
    expect(JSON.parse(seen[0].data)).toEqual({ patientNumber: null })
    expect(JSON.parse(seen[1].data)).toEqual({ patientNumber: '4377' })
  })
})
