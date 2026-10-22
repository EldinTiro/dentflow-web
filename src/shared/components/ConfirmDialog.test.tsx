import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('is an accessible dialog named by its title', () => {
    render(<ConfirmDialog open title="Deactivate Pink Dent?" description="x" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Deactivate Pink Dent?' })).toBeInTheDocument()
  })

  // QA-027: Escape did not close some dialogs
  it('cancels on Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="T" description="x" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
