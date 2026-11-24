import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { AppointmentsPage } from './AppointmentsPage'
import { useAuthStore } from '@/features/auth/store/authStore'

const { empty } = vi.hoisted(() => ({ empty: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 20 }) }))
vi.mock('../services/appointmentService', async (orig) => ({
  ...(await orig<typeof import('../services/appointmentService')>()),
  appointmentService: { list: vi.fn(empty), listTypes: vi.fn(async () => []) },
}))
vi.mock('@/features/staff/services/staffService', () => ({ staffService: { list: vi.fn(empty) } }))

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

describe('AppointmentsPage view toggle', () => {
  // Clinics plan their day on the calendar, so that is where the page opens
  it('opens on the calendar', () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
    )

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  })

  // QA-029: the toggle kept one view highlighted while the other was shown
  it('marks the view that is actually shown, and keeps the list in the URL', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
      { route: '/appointments' },
    )
    const list = screen.getByRole('button', { name: 'List' })
    const week = screen.getByRole('button', { name: 'Week' })

    await userEvent.click(list)

    expect(list).toHaveAttribute('aria-pressed', 'true')
    expect(week).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('location')).toHaveTextContent('tab=list')

    await userEvent.click(week)
    expect(week).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('location')).not.toHaveTextContent('tab=list')
  })

  // User request 2026-11-10 (variant B): the toolbar row above the calendar is gone; the
  // view switch is one group, and the period shown sits under the title
  it('has one view switch and no separate toolbar row', () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← Prev' })).not.toBeInTheDocument()
    expect(screen.getByText('14 – 20 Dec 2026')).toBeInTheDocument()
  })

  // User request 2026-11-11: the period picker marks today and jumps to it, so no Today button
  it('has no Today button', () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
  })

  // User request 2026-11-10: a click on a day in the week opens the day view on it
  it('opens the day view on a day clicked in the week', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open Thursday 17' }))

    expect(screen.getByTestId('location')).toHaveTextContent('view=day')
    expect(screen.getByTestId('location')).toHaveTextContent('day=2026-12-17')
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
  })

  // User request 2026-11-10: the arrows sit next to the period, not on the calendar
  it('steps weeks with the arrows next to the period', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('21 – 27 Dec 2026')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.getByText('7 – 13 Dec 2026')).toBeInTheDocument()
  })

  it('steps weeks with the arrow keys', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('21 – 27 Dec 2026')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByText('7 – 13 Dec 2026')).toBeInTheDocument()
  })

  // User request 2026-11-10: jump to a date from the period under the title
  it('jumps to the week of a date picked from the period', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    await userEvent.click(screen.getByRole('button', { name: /14 – 20 Dec 2026/ }))
    const picker = screen.getByRole('dialog', { name: 'Pick a date' })
    await userEvent.click(within(picker).getByRole('button', { name: 'Next month' }))
    await userEvent.click(within(picker).getByRole('button', { name: '14 January 2027' }))

    expect(screen.getByText('11 – 17 Jan 2027')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Pick a date' })).not.toBeInTheDocument()
  })

  it('opens the picked day in the day view', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<><AppointmentsPage /><Location /></>} /></Routes>,
      { route: '/appointments?view=day&day=2026-12-16' },
    )

    await userEvent.click(screen.getByRole('button', { name: /16\/12\/2026/ }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Pick a date' })).getByRole('button', { name: '3 December 2026' }))

    expect(screen.getByTestId('location')).toHaveTextContent('day=2026-12-03')
  })

  it('closes the picker on Escape', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?from=2026-12-16' },
    )

    await userEvent.click(screen.getByRole('button', { name: /14 – 20 Dec 2026/ }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Pick a date' })).not.toBeInTheDocument()
  })
})

describe('AppointmentsPage filters', () => {
  // DR-36: the filter controls had no accessible name at all
  it('gives every filter control an accessible name', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?tab=list' },
    )

    expect(screen.getByRole('textbox', { name: 'Search appointments' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next period' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Search appointments' }), 'x')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })
})

describe('AppointmentsPage provider names', () => {
  // People-merge plan B6: GET /staff is active-only by default, but past appointments
  // of a deactivated dentist must still show their name
  it('loads every staff member, inactive ones included', async () => {
    const { staffService } = await import('@/features/staff/services/staffService')
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments' },
    )

    await vi.waitFor(() => expect(staffService.list).toHaveBeenCalledWith(expect.objectContaining({ isActive: 'all' })))
  })
})

describe('AppointmentsPage list and calendar (DT-24, DT-25)', () => {
  const appt = (id: string, startAt: string, status: string, patientName: string) => ({
    id, patientId: `p-${id}`, patientName, providerId: 'prov-1', appointmentTypeId: 't', status, startAt,
    endAt: startAt, durationMinutes: 30, isNewPatient: false, chiefComplaint: null, notes: null,
  })

  it('sorts by start time only — a cancelled 00:30 visit stays before 20:00', async () => {
    const { appointmentService } = await import('../services/appointmentService')
    vi.mocked(appointmentService.list).mockResolvedValue({
      items: [appt('a', '2026-11-10T19:00:00Z', 'Scheduled', 'Evening Patient'), appt('b', '2026-11-09T23:30:00Z', 'Cancelled', 'Night Patient')],
      totalCount: 2, page: 1, pageSize: 50,
    } as never)
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?tab=list&from=2026-11-09&to=2026-11-10' },
    )

    const night = await screen.findByText('Night Patient')
    const evening = screen.getByText('Evening Patient')
    expect(night.compareDocumentPosition(evening) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // User request 2026-11-11: no "Start treatment" step; a checked-in visit is completed next
  it('offers Complete, not Start treatment, for a checked-in visit in the list', async () => {
    const { appointmentService } = await import('../services/appointmentService')
    vi.mocked(appointmentService.list).mockResolvedValue({
      items: [appt('c', '2026-11-10T09:00:00Z', 'CheckedIn', 'Waiting Patient')], totalCount: 1, page: 1, pageSize: 50,
    } as never)
    useAuthStore.getState().setAuth('t', { userId: 'u', email: 'e@x', fullName: 'Desk', roles: ['Staff'] })
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?tab=list&from=2026-11-09&to=2026-11-10' },
    )

    await screen.findByText('Waiting Patient')
    expect(screen.getByRole('button', { name: /Complete/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start Treatment/ })).not.toBeInTheDocument()
    useAuthStore.getState().clearAuth()
  })

  it('opens the calendar on the week given in the URL', async () => {
    renderWithProviders(
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>,
      { route: '/appointments?tab=calendar&from=2026-11-11&to=2026-11-11' },
    )

    // The week label follows the app language (it was English in Bosnian too)
    expect(await screen.findByText('9 – 15 Nov 2026')).toBeInTheDocument()
  })
})
