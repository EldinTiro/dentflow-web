import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AppointmentTypeDrawer } from './AppointmentTypeDrawer'

describe('AppointmentTypeDrawer', () => {
  // QA-031: offered "Bookable online (patient-facing portal)" — no portal exists
  it('does not offer online booking while there is no patient portal', () => {
    renderWithProviders(<AppointmentTypeDrawer onClose={() => {}} />)
    expect(screen.queryByLabelText(/bookable online/i)).not.toBeInTheDocument()
  })
})
