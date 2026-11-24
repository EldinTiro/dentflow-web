import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AppVersion } from './AppVersion'

vi.mock('@/shared/api/client', () => ({
  default: { get: vi.fn(async () => ({ data: { commit: 'e4f5a6b7c8d9', builtAt: '2026-11-13T14:30:00Z' } })) },
}))

// User request 2026-11-13: the build running, small in a corner, only where it was deployed
describe('AppVersion', () => {
  it('shows nothing for a local run, which has no build', () => {
    const { container } = renderWithProviders(<AppVersion build={{ commit: undefined, builtAt: undefined, env: undefined }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the date and the short commit of the build, with both builds on hover', async () => {
    renderWithProviders(<AppVersion build={{ commit: 'a1b2c3d4e5f6', builtAt: '2026-11-13T14:32:00Z', env: 'production' }} />)

    const version = screen.getByText(/a1b2c3d/)
    expect(version).toHaveTextContent('v2026.11.13 · a1b2c3d')
    expect(screen.queryByText('TEST')).not.toBeInTheDocument()
    await vi.waitFor(() => expect(version.closest('[title]')).toHaveAttribute('title', expect.stringContaining('API: e4f5a6b')))
    expect(version.closest('[title]')).toHaveAttribute('title', expect.stringContaining('Web: a1b2c3d'))
  })

  it('marks a test environment', () => {
    renderWithProviders(<AppVersion build={{ commit: 'a1b2c3d4e5f6', builtAt: '2026-11-13T14:32:00Z', env: 'test' }} />)

    expect(screen.getByText('TEST')).toBeInTheDocument()
  })
})
