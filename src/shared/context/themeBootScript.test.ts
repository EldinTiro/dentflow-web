import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * DR-12: index.html paints the theme before React loads. It must make the same
 * choice as ThemeContext's getInitialDarkMode() — saved theme, else the OS setting —
 * or the page flashes one theme and then switches. QA-021 removed the clock-based
 * switch from ThemeContext but left it in this script.
 */
const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf-8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

function runBootScript({ saved, osDark, hour }: { saved: string | null; osDark: boolean; hour: number }) {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
  if (saved) localStorage.setItem('theme', saved)
  vi.setSystemTime(new Date(2026, 9, 22, hour, 0))
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === '(prefers-color-scheme: dark)' ? osDark : false,
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  new Function(script)()
  return document.documentElement.classList.contains('dark')
}

describe('index.html theme boot script', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  it('is present', () => expect(script).toContain('localStorage'))

  it.each([
    { saved: 'dark', osDark: false, hour: 12, dark: true },
    { saved: 'light', osDark: true, hour: 23, dark: false },
    { saved: null, osDark: true, hour: 12, dark: true },
    { saved: null, osDark: false, hour: 23, dark: false },
  ])('saved=$saved os-dark=$osDark at $hour:00 → dark=$dark', ({ dark, ...input }) => {
    expect(runBootScript(input)).toBe(dark)
  })
})
