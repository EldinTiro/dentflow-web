import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import i18n from 'i18next'

const first = (r: z.SafeParseReturnType<unknown, unknown>) => (r.success ? null : r.error.issues[0].message)

describe('zod messages', () => {
  afterEach(() => i18n.changeLanguage('en'))

  // QA-020: Bosnian UI showed "String must contain at least 2 character(s)" and "Invalid email"
  it('are in the UI language', async () => {
    await i18n.changeLanguage('bs')
    expect(first(z.string().min(2).safeParse('a'))).toBe('Najmanje 2 znaka')
    expect(first(z.string().email().safeParse('x'))).toBe('Unesite ispravnu email adresu')
    expect(first(z.string().min(1).safeParse(''))).toBe('Obavezno polje')
  })

  it('stay readable in English', () => {
    expect(first(z.string().min(2).safeParse('a'))).toBe('At least 2 characters')
    expect(first(z.string().email().safeParse('x'))).toBe('Enter a valid email address')
  })
})
