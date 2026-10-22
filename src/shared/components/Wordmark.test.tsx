import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from './Wordmark'

describe('Wordmark', () => {
  // The visual is "DENT·FLOW" (wide caps + separator dot); assistive tech must
  // still hear the product name, not spelled-out letters or "dot".
  it('is announced as the plain brand name', () => {
    render(<h1><Wordmark /></h1>)
    expect(screen.getByRole('heading', { name: 'DentFlow' })).toBeInTheDocument()
  })
})
