import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppointmentChipBody, chipTextColor } from './AppointmentChipBody'

describe('AppointmentChipBody', () => {
  // User report: a 30-minute visit cut "Eldin Tiro · Extraction" in half
  it('puts a short visit on one line', () => {
    const { container } = render(<AppointmentChipBody time="01:00" label="Eldin Tiro · Extraction" color="#eab308" durationMinutes={30} dark={false} />)

    const line = container.querySelector('[data-layout="one-line"]')!
    expect(line).toHaveTextContent('01:00 Eldin Tiro · Extraction')
  })

  it('gives a longer visit a line for the time and one for the name', () => {
    const { container } = render(<AppointmentChipBody time="08:00" label="Nerma Tiro · Root Canal" color="#eab308" durationMinutes={90} dark={false} />)

    expect(container.querySelector('[data-layout="two-lines"]')).toHaveTextContent('08:00Nerma Tiro · Root Canal')
  })
})

// User report: yellow time on a pale yellow chip could hardly be read
describe('chipTextColor', () => {
  it('darkens the doctor colour on a light background and lightens it on a dark one', () => {
    expect(chipTextColor('#eab308', false)).toBe('color-mix(in srgb, #eab308 55%, black)')
    expect(chipTextColor('#eab308', true)).toBe('color-mix(in srgb, #eab308 70%, white)')
  })
})
