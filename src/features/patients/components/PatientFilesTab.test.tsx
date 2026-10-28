import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { renderWithProviders, fastEndpointsError } from '@/test/render'
import { FeatureProvider } from '@/shared/context/FeatureContext'
import { tenantService } from '@/features/admin/services/tenantService'
import { documentService } from '../services/documentService'
import { PatientFilesTab } from './PatientFilesTab'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/features/admin/services/tenantService', () => ({ tenantService: { getFeatures: vi.fn() } }))
vi.mock('../services/documentService', async (orig) => ({
  ...(await orig<typeof import('../services/documentService')>()),
  documentService: { list: vi.fn(async () => []), upload: vi.fn() },
}))

function renderOnPlan(flags: string[], plan = flags.length ? 'Pro' : 'Free') {
  vi.mocked(tenantService.getFeatures).mockResolvedValue({ flags, quotas: {}, plan } as never)
  return renderWithProviders(<FeatureProvider><PatientFilesTab patientId="p1" canManage /></FeatureProvider>)
}

async function pickAndUpload(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, new File(['x'], 'xray.jpg', { type: 'image/jpeg' }))
  await user.click(screen.getByRole('button', { name: /upload 1 file/i }))
}

// Production report: on the Free plan an upload ended in a bare 403 and a red icon
describe('PatientFilesTab — plans and refused uploads', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows a plan notice instead of the upload form when the plan has no document storage', async () => {
    renderOnPlan([])

    expect(await screen.findByText(/available on the Pro and Enterprise plans/i)).toBeInTheDocument()
    expect(screen.queryByText(/choose files/i)).not.toBeInTheDocument()
  })

  it('offers the upload form on a plan with document storage', async () => {
    renderOnPlan(['DocumentStorage'])

    expect(await screen.findByText(/choose files/i)).toBeInTheDocument()
    expect(screen.queryByText(/available on the Pro and Enterprise plans/i)).not.toBeInTheDocument()
  })

  it('shows the reason the API gave for a refused upload', async () => {
    vi.mocked(documentService.upload).mockRejectedValue(fastEndpointsError('The file is larger than 10 MB.', 'Document.TooLarge', 400))
    const user = userEvent.setup()
    renderOnPlan(['DocumentStorage'])
    await screen.findByText(/choose files/i)

    await pickAndUpload(user)

    expect(await screen.findByText('The file is larger than 10 MB.')).toBeInTheDocument()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/larger than 10 MB/)))
  })

  it('explains a plan refusal in the user language', async () => {
    vi.mocked(documentService.upload).mockRejectedValue(
      fastEndpointsError('This feature is not available on your current plan.', 'feature.NotAvailableOnCurrentPlan', 403))
    const user = userEvent.setup()
    renderOnPlan(['DocumentStorage'])
    await screen.findByText(/choose files/i)

    await pickAndUpload(user)

    expect(await screen.findByText(/available on the Pro and Enterprise plans/i)).toBeInTheDocument()
  })
})
