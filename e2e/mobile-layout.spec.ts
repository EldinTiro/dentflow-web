import { test, expect, type Page } from '@playwright/test'
import { account, login as signIn } from './support'

/**
 * Mobile layout guards from the design review (documentation/design-review-2026-10-22.md).
 *
 * `document.scrollWidth` cannot see these: the page itself never overflows, the
 * offending element is clipped inside an `overflow-hidden` parent instead (DR-34).
 */

test.use({ viewport: { width: 375, height: 812 } })

async function login(page: Page) {
  await signIn(page, account('OWNER'))
}

async function expectInsideViewport(page: Page, name: RegExp) {
  const button = page.getByRole('button', { name })
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  const width = page.viewportSize()!.width
  expect(box, 'button must have a layout box').not.toBeNull()
  expect(box!.x, 'button starts inside the viewport').toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, 'button ends inside the viewport').toBeLessThanOrEqual(width)
}

for (const tab of ['list', 'calendar'] as const) {
  test(`Book Appointment is fully on-screen at 375px (${tab} tab) — DR-34`, async ({ page }) => {
    await login(page)
    await page.goto(`/appointments${tab === 'calendar' ? '?tab=calendar' : ''}`)
    await expectInsideViewport(page, /book appointment|zakaži termin|termin buchen/i)
  })
}
