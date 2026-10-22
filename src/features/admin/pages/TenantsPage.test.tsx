import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { TenantsPage } from './TenantsPage'
import { tenantService } from '../services/tenantService'

vi.mock('../services/tenantService', () => ({
  tenantService: {
    list: vi.fn(async () => ({
      items: [{ id: 't1', slug: 'pink-dent', name: 'Pink Dent', plan: 'Free', planExpiresAt: null, isActive: true, createdAt: '2026-01-01T00:00:00Z', logoBase64: null }],
      totalCount: 1, page: 1, pageSize: 20,
    })),
    deactivate: vi.fn(async () => undefined),
    activate: vi.fn(),
  },
}))

describe('TenantsPage', () => {
  // QA-013: Deactivate suspended a whole clinic on a single click
  it('asks for confirmation before deactivating a clinic', async () => {
    renderWithProviders(<TenantsPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }))
    expect(tenantService.deactivate).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(tenantService.deactivate).toHaveBeenCalledWith('t1'))
  })

  // QA-028: the tenant search had no label
  it('labels the search field', () => {
    renderWithProviders(<TenantsPage />)
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
  })
})
