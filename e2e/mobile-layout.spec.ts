import { test, expect, type Page } from '@playwright/test'

/**
 * Mobile layout guards from the design review (documentation/design-review-2026-10-22.md).
 *
 * `document.scrollWidth` cannot see these: the page itself never overflows, the
 * offending element is clipped inside an `overflow-hidden` parent instead (DR-34).
 */

const PINK = {
  email: 'pink@dentflow.local',
  password: 'Tmp_ebeb16502fe54a8ca15144ad6b230c61!A1',
}

test.use({ viewport: { width: 375, height: 812 } })

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill(PINK.email)
  await page.locator('#password').fill(PINK.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
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
