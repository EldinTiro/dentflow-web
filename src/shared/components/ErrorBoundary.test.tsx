import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => consoleError.mockClear())

  // QA-001: with no boundary anywhere, one render error blanked the whole app
  it('shows a fallback instead of unmounting when a child throws', () => {
    render(
      <div>
        <p>shell stays</p>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </div>,
    )

    expect(screen.getByText('shell stays')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
  })

  it('recovers when the reset key changes (e.g. navigating to another page)', async () => {
    function Harness() {
      const [page, setPage] = useState('broken')
      return (
        <>
          <button onClick={() => setPage('ok')}>navigate</button>
          <ErrorBoundary resetKey={page}>{page === 'broken' ? <Boom /> : <p>other page</p>}</ErrorBoundary>
        </>
      )
    }
    render(<Harness />)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await userEvent.click(screen.getByText('navigate'))

    expect(screen.getByText('other page')).toBeInTheDocument()
  })
})
