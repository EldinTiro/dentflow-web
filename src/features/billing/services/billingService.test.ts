import { describe, it, expect, afterEach } from 'vitest'
import { captureRequests, restoreRequests } from '@/test/captureRequests'
import { billingService } from './billingService'

describe('billingService.createFromTreatmentPlan', () => {
  afterEach(() => restoreRequests())

  // QA-006: a body-less POST drops Content-Type and the API answers 415
  // axios' XHR adapter strips Content-Type whenever the body is undefined, so the
  // body is what has to be asserted here.
  it('posts a JSON body so the request keeps Content-Type: application/json', async () => {
    const seen = captureRequests()

    await billingService.createFromTreatmentPlan('plan-1')

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/api/v1/treatment-plans/plan-1/invoice')
    expect(seen[0].data).toBe('{}')
    expect(seen[0].headers['Content-Type']).toMatch(/application\/json/)
  })
})

describe('billingService.list', () => {
  afterEach(() => restoreRequests())

  // QA-008: an invoice issued at 01:05 local on 22 Oct was outside the "22–22" filter
  it('sends the local days as their exact UTC bounds', async () => {
    const seen = captureRequests({ items: [], totalCount: 0 })

    await billingService.list({ from: '2026-10-22', to: '2026-10-22' })

    expect(seen[0].params).toMatchObject({
      from: '2026-10-21T22:00:00.000Z',
      to: '2026-10-22T21:59:59.999Z',
    })
  })
})
