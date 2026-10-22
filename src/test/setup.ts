import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@/i18n'
import i18n from 'i18next'

// Tests assert on English copy regardless of the machine's locale.
void i18n.changeLanguage('en')

afterEach(() => cleanup())
