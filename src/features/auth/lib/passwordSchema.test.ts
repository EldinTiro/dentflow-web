import { describe, it, expect } from 'vitest'
import { passwordSchema } from './passwordSchema'

describe('passwordSchema', () => {
  const strong = 'Novi-Pass-2026!'

  it('accepts a strong, different new password', () => {
    expect(passwordSchema.safeParse({ currentPassword: 'Tmp_old!A1abc', newPassword: strong, confirmPassword: strong }).success).toBe(true)
  })

  // DT-04: "changing" the temporary password to itself was accepted
  it('refuses a new password equal to the current one', () => {
    const result = passwordSchema.safeParse({ currentPassword: strong, newPassword: strong, confirmPassword: strong })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain('common:validation.passwordUnchanged')
  })
})
