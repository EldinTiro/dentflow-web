import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { renderWithProviders } from '@/test/render'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  afterEach(() => i18n.changeLanguage('en'))

  // DT-28: the login page kept the last user's language and offered no way to change it
  it('lets you pick the language before signing in', async () => {
    await i18n.changeLanguage('bs')
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(i18n.language).toBe('en')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })
})
