import { describe, it, expect, beforeEach } from 'vitest'
import { initialLanguage } from './language'

// User request 2026-11-13: a new address (app.mydentflow.com) opened in English because the
// browser's language decided. The clinic works in Bosnian: that is the start, until chosen.
describe('initialLanguage', () => {
  beforeEach(() => localStorage.clear())

  it('starts in Bosnian when nothing was chosen, whatever the browser says', () => {
    expect(initialLanguage()).toBe('bs')
  })

  it('keeps a language chosen before', () => {
    localStorage.setItem('i18nextLng', 'de')
    expect(initialLanguage()).toBe('de')
  })

  it('ignores a language the app does not have', () => {
    localStorage.setItem('i18nextLng', 'fr-FR')
    expect(initialLanguage()).toBe('bs')
  })
})
