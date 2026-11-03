import { describe, it, expect } from 'vitest'
import { hourHeightFor, MIN_HOUR_PX } from './calendarGrid'

// User request: the calendar left empty space below the grid, and 15-minute visits were too
// thin to read. The hours now fill the space there is.
describe('hourHeightFor', () => {
  it('fills the height there is', () => {
    expect(hourHeightFor(900, 9)).toBe(100)
  })

  // 15 minutes must stay tall enough for a line of text
  it('never goes below the minimum, scrolling instead', () => {
    expect(hourHeightFor(300, 9)).toBe(MIN_HOUR_PX)
    expect(MIN_HOUR_PX / 4).toBeGreaterThanOrEqual(20)
  })
})
