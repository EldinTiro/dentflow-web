import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import i18n from 'i18next'
import { toast } from 'sonner'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { TenantDetailPage } from './TenantDetailPage'
import { tenantService } from '../services/tenantService'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../services/tenantService', () => ({
  tenantService: {
    getById: vi.fn(),
    update: vi.fn(),
    updatePlan: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}))

const tenant = {
  id: 't1', slug: 'pink-dent', name: 'Pink Dent', plan: 'Free', planExpiresAt: null,
  isActive: true, createdAt: '2026-01-01T00:00:00Z', logoBase64: null,
}

function renderPage() {
  renderWithProviders(
    <Routes>
      <Route path="/admin/tenants/:id" element={<TenantDetailPage />} />
    </Routes>,
    { route: '/admin/tenants/t1' },
  )
}

describe('TenantDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tenantService.getById).mockResolvedValue(tenant)
  })
  afterEach(() => i18n.changeLanguage('en'))

  // QA-014: the option had no value, so BS sent "Besplatni" / DE "Kostenlos"
  it('submits the plan code regardless of the UI language', async () => {
    await i18n.changeLanguage('bs')
    vi.mocked(tenantService.updatePlan).mockResolvedValue(tenant)
    renderPage()
    const user = userEvent.setup()

    const select = await screen.findByRole('combobox')
    expect(select).toHaveValue('Free')
    await user.selectOptions(select, 'Pro')
    await user.click(screen.getByRole('button', { name: i18n.t('admin:tenant.detail.updatePlan') }))

    await waitFor(() => expect(tenantService.updatePlan).toHaveBeenCalledWith('t1', { plan: 'Pro' }))
  })

  // QA-014: admin mutations failed silently
  it('shows the API error when a change fails', async () => {
    vi.mocked(tenantService.updatePlan).mockRejectedValue(fastEndpointsError('Plan must be Free, Pro, or Enterprise.'))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Update Plan' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Plan must be Free, Pro, or Enterprise.'))
  })

  // QA-014: an empty name could be submitted
  it('does not submit an empty practice name', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.clear(await screen.findByDisplayValue('Pink Dent'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/required/i)).toBeInTheDocument()
    expect(tenantService.update).not.toHaveBeenCalled()
  })

  // QA-013: deactivation fired on a single click
  it('asks for confirmation before deactivating the clinic', async () => {
    vi.mocked(tenantService.deactivate).mockResolvedValue(undefined)
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Deactivate Tenant' }))
    expect(tenantService.deactivate).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /deactivate/i }))
    await waitFor(() => expect(tenantService.deactivate).toHaveBeenCalledWith('t1'))
  })
})
