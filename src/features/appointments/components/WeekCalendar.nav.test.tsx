import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekCalendar } from './WeekCalendar'

// User request 2026-11-10 (variant B): step weeks from the calendar itself, not a toolbar row
describe('WeekCalendar navigation', () => {
  it('has previous and next week arrows in its day header', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<WeekCalendar weekStart={new Date(2026, 10, 9)} appointments={[]} providerColors={{}} providerNames={{}}
      patientNames={{}} appointmentTypeNames={{}} onPrev={onPrev} onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  // User request 2026-11-10: no Saturday and Sunday columns when the clinic is closed then
  it('leaves out the days it is told to hide', () => {
    const { container } = render(<WeekCalendar weekStart={new Date(2026, 10, 9)} appointments={[]} providerColors={{}} providerNames={{}}
      patientNames={{}} appointmentTypeNames={{}} hiddenDates={['2026-11-14', '2026-11-15']} />)

    expect(screen.getByText('Friday')).toBeInTheDocument()
    expect(screen.queryByText('Saturday')).toBeNull()
    expect(screen.queryByText('Sunday')).toBeNull()
    expect(container.querySelectorAll('[data-drop-day]')).toHaveLength(5)
  })

  // User request 2026-11-10: a click on a day in the week opens that day
  it('opens a day from its header', () => {
    const onDayClick = vi.fn()
    render(<WeekCalendar weekStart={new Date(2026, 10, 9)} appointments={[]} providerColors={{}} providerNames={{}}
      patientNames={{}} appointmentTypeNames={{}} onDayClick={onDayClick} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Wednesday 11' }))

    expect(onDayClick).toHaveBeenCalledWith('2026-11-11')
  })
})
