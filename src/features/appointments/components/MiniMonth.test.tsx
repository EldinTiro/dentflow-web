import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MiniMonth, monthWeeks } from './MiniMonth'
import { isoDate } from './calendarGrid'

// User request 2026-11-10: pick a date to jump to, from a small month
describe('monthWeeks', () => {
  it('gives whole Monday-first weeks around the month', () => {
    const weeks = monthWeeks(2026, 10) // November 2026

    expect(weeks).toHaveLength(6)
    expect(isoDate(weeks[0][0])).toBe('2026-10-26')
    expect(isoDate(weeks[5][6])).toBe('2026-12-06')
  })

  it('needs only as many weeks as the month spans', () => {
    expect(monthWeeks(2027, 1)).toHaveLength(4) // February 2027 starts on a Monday
  })
})

describe('MiniMonth', () => {
  it('shows the month of the selected date and picks a day', () => {
    const onPick = vi.fn()
    render(<MiniMonth selected="2026-11-12" onPick={onPick} />)

    expect(screen.getByText('November 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '24 November 2026' }))

    expect(onPick).toHaveBeenCalledWith('2026-11-24')
  })

  it('pages to the next and previous month', () => {
    render(<MiniMonth selected="2026-11-12" onPick={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('December 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
  })

  it('marks the selected day', () => {
    render(<MiniMonth selected="2026-11-12" onPick={vi.fn()} />)

    expect(screen.getByRole('button', { name: '12 November 2026' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '13 November 2026' })).toHaveAttribute('aria-pressed', 'false')
  })
})
