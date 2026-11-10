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

  // User request 2026-11-10: moving a visit is not destructive, so no red button
  it('confirms in the primary colour when the action is not destructive', () => {
    render(<ConfirmDialog open tone="primary" title="Move?" description="x" confirmLabel="Move" onConfirm={() => {}} onCancel={() => {}} />)
    const confirm = screen.getByRole('button', { name: 'Move' })
    expect(confirm).toHaveClass('bg-primary-600')
    expect(confirm).not.toHaveClass('bg-red-600')
  })

  it('confirms in red by default', () => {
    render(<ConfirmDialog open title="Delete?" description="x" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600')
  })
})
