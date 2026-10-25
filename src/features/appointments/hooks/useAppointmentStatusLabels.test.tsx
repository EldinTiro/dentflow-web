import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import i18n from 'i18next'
import { useAppointmentStatusLabels } from './useAppointmentStatusLabels'

describe('useAppointmentStatusLabels', () => {
  afterEach(() => i18n.changeLanguage('en'))

  // User report: the dashboard said "Scheduled" with Bosnian selected
  it.each([
    ['en', 'Scheduled', 'No Show'],
    ['bs', 'Zakazan', 'Nije se pojavio'],
    ['de', 'Geplant', 'Nicht erschienen'],
  ])('speaks the selected language (%s)', async (lang, scheduled, noShow) => {
    await i18n.changeLanguage(lang)
    const { result } = renderHook(() => useAppointmentStatusLabels())

    expect(result.current.Scheduled).toBe(scheduled)
    expect(result.current.NoShow).toBe(noShow)
  })
})
