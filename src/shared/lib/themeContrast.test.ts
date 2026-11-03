import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// User report: in the light theme some buttons and texts could hardly be seen. Measured on
// 14 pages: teal-600 was 3.74:1 on white (text needs 4.5:1), rose-600 3.58:1 on its own tint,
// and control outlines in gray-300 1.4:1 (WCAG 1.4.11 asks 3:1).

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Every colour palette: the default on :root and each [data-color-theme]. */
const palettes = [...css.matchAll(/(:root|\[data-color-theme="(\w+)"\])\s*\{([^}]*)\}/g)].map((m) => {
  const vars = Object.fromEntries([...m[3].matchAll(/--p-(\d+):\s*(#[0-9a-f]{6})/gi)].map((v) => [v[1], v[2]]))
  return { name: m[2] ?? 'default', vars }
}).filter((p) => p.vars['600'])

describe('light theme contrast', () => {
  it('finds the palettes', () => {
    expect(palettes.map((p) => p.name)).toEqual(['default', 'rose', 'teal', 'blue', 'violet'])
  })

  // Buttons are white on primary-600; links, tabs and "Today" are primary-600 on white or on primary-50
  it.each(palettes.map((p) => [p.name, p.vars] as const))('%s: primary-600 reads as text', (_name, vars) => {
    expect(contrast(vars['600'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(vars['600'], vars['50'])).toBeGreaterThanOrEqual(4.5)
    // Hover is darker still
    expect(contrast(vars['700'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('control outlines stand out from white and from the grey page', () => {
    const control = css.match(/--color-control:\s*(#[0-9a-f]{6})/i)?.[1]
    expect(control).toBeDefined()
    expect(contrast(control!, '#ffffff')).toBeGreaterThanOrEqual(3)
    expect(contrast(control!, '#f9fafb')).toBeGreaterThanOrEqual(3) // gray-50, the page
  })
})
