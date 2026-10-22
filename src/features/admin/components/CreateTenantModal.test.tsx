import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { CreateTenantModal } from './CreateTenantModal'

describe('CreateTenantModal', () => {
  // QA-027: Escape did not close the New Tenant modal
  it('closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<CreateTenantModal onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })
})
