import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { staffService } from '@/features/staff/services/staffService'
import { AbsencesWidget } from './AbsencesWidget'

vi.mock('@/features/staff/services/staffService', () => ({
  staffService: {
    list: vi.fn(async () => ({
      items: [
        { id: 'p1', fullName: 'Eldina Muhić', colorHex: '#ef4444' },
        { id: 'p2', fullName: 'Ana Rozić', colorHex: '#3b82f6' },
      ],
      totalCount: 2, page: 1, pageSize: 100,
    })),
    listClinicAbsences: vi.fn(async () => [
      // Ana is off sick today; Eldina goes on holiday on Wednesday
      { id: 'b2', staffMemberId: 'p2', startAt: '2026-10-23T07:00:00Z', endAt: '2026-10-26T16:00:00Z', absenceType: 'Sickness', notes: null },
      { id: 'b1', staffMemberId: 'p1', startAt: '2026-10-28T07:00:00Z', endAt: '2026-10-30T16:00:00Z', absenceType: 'Vacation', notes: null },
    ]),
  },
}))

describe('AbsencesWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T09:00:00')) // Sunday, Sarajevo time
  })
  afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); await i18n.changeLanguage('en') })

  // User request: show on the dashboard that Eldina will be on holiday
  it('lists who is away now and who will be away soon', async () => {
    renderWithProviders(<AbsencesWidget />)

    const eldina = (await screen.findByText('Eldina Muhić')).closest('li')!
    expect(within(eldina).getByText(/Vacation/)).toBeInTheDocument()
    expect(within(eldina).getByText('in 3 days')).toBeInTheDocument()
    expect(within(eldina).getByText(/28\/10\/2026.*30\/10\/2026/)).toBeInTheDocument()

    const ana = screen.getByText('Ana Rozić').closest('li')!
    expect(within(ana).getByText(/Sick leave/)).toBeInTheDocument()
    expect(within(ana).getByText('Away today')).toBeInTheDocument()
  })

  it('opens the absence tab of the person', async () => {
    renderWithProviders(<AbsencesWidget />)

    expect((await screen.findByText('Eldina Muhić')).closest('a')).toHaveAttribute('href', '/staff/p1?tab=absence')
  })

  it('asks for the next two weeks, from the start of the local day', async () => {
    renderWithProviders(<AbsencesWidget />)

    await screen.findByText('Eldina Muhić')
    expect(staffService.listClinicAbsences).toHaveBeenCalledWith({
      from: new Date('2026-10-25T00:00:00').toISOString(),
      to: new Date('2026-11-08T23:59:59.999').toISOString(),
    })
  })

  it('says so when nobody is away', async () => {
    vi.mocked(staffService.listClinicAbsences).mockResolvedValueOnce([])
    renderWithProviders(<AbsencesWidget />)

    expect(await screen.findByText('Nobody is away in the next two weeks.')).toBeInTheDocument()
  })

  // The in-app browser has no Bosnian data for Intl.RelativeTimeFormat and showed "+3 d"
  it.each([
    ['bs', 'za 3 dana', 'Danas odsutan/na'],
    ['de', 'in 3 Tagen', 'Heute abwesend'],
  ])('says when in the selected language (%s)', async (lang, inThreeDays, today) => {
    // What that browser's Intl does without locale data
    vi.stubGlobal('Intl', Object.assign(Object.create(Intl), {
      RelativeTimeFormat: class { format(n: number) { return `+${n} d` } },
    }))
    await i18n.changeLanguage(lang)
    renderWithProviders(<AbsencesWidget />)

    const eldina = (await screen.findByText('Eldina Muhić')).closest('li')!
    expect(within(eldina).getByText(inThreeDays)).toBeInTheDocument()
    expect(within(screen.getByText('Ana Rozić').closest('li')!).getByText(today)).toBeInTheDocument()
  })

  it('says tomorrow for an absence that starts tomorrow', async () => {
    vi.mocked(staffService.listClinicAbsences).mockResolvedValueOnce([
      { id: 'b3', staffMemberId: 'p1', startAt: '2026-10-26T07:00:00Z', endAt: '2026-10-26T16:00:00Z', absenceType: 'Vacation', notes: null },
    ])
    await i18n.changeLanguage('bs')
    renderWithProviders(<AbsencesWidget />)

    expect(await screen.findByText('sutra')).toBeInTheDocument()
  })
})
