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
    vi.mocked(documentService.upload).mockRejectedValue(fastEndpointsError('This file type is not supported.', 'Document.UnsupportedType', 400))
    const user = userEvent.setup()
    renderOnPlan(['DocumentStorage'])
    await screen.findByText(/choose files/i)

    await pickAndUpload(user)

    expect(await screen.findByText('This file type is not supported.')).toBeInTheDocument()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/file type is not supported/)))
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

// Production report: a 1.7 MB phone photo failed on nginx's 1 MB default. Limit is now 20 MB.
describe('PatientFilesTab — file size', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function bigFile(bytes: number) {
    const file = new File(['x'], 'huge.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: bytes })
    return file
  }

  it('refuses a file over 20 MB as soon as it is picked, without uploading it', async () => {
    const user = userEvent.setup()
    renderOnPlan(['DocumentStorage'])
    await screen.findByText(/choose files/i)

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, bigFile(20 * 1024 * 1024 + 1))

    expect(await screen.findByText(/larger than 20 MB/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload 1 file/i })).not.toBeInTheDocument()
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('says the file is too large when the server answers 413', async () => {
    vi.mocked(documentService.upload).mockRejectedValue(
      Object.assign(new Error('413'), { isAxiosError: true, response: { status: 413, data: '<html>413 Request Entity Too Large</html>' } }))
    const user = userEvent.setup()
    renderOnPlan(['DocumentStorage'])
    await screen.findByText(/choose files/i)

    await pickAndUpload(user)

    expect(await screen.findByText(/larger than 20 MB/i)).toBeInTheDocument()
  })
})
