import { describe, it, expect } from 'vitest'
import { shouldRetry } from './queryClient'

const httpError = (status: number) => Object.assign(new Error(String(status)), { isAxiosError: true, response: { status } })

describe('shouldRetry', () => {
  // QA-033: every 404/403 was requested twice
  it('does not retry client errors', () => {
    expect(shouldRetry(0, httpError(404))).toBe(false)
    expect(shouldRetry(0, httpError(403))).toBe(false)
  })

  it('retries a server or network error once', () => {
    expect(shouldRetry(0, httpError(503))).toBe(true)
    expect(shouldRetry(0, new Error('Network Error'))).toBe(true)
    expect(shouldRetry(1, httpError(503))).toBe(false)
  })
})
