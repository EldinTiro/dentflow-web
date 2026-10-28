import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TempPasswordBox } from './TempPasswordBox'

describe('TempPasswordBox', () => {
  // QA-030: the temporary password had to be selected and copied by hand
  it('copies the password to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<TempPasswordBox password="Tmp_abc123!A1" />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('Tmp_abc123!A1')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  // DT-27: a denied clipboard ended in an uncaught NotAllowedError and no feedback
  it('says so and selects the password when the clipboard is not available', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    render(<TempPasswordBox password="Tmp_abc123!A1" />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(await screen.findByText(/couldn't copy/i)).toBeInTheDocument()
    expect(window.getSelection()?.toString()).toBe('Tmp_abc123!A1')
  })
})
