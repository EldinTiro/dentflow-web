import { test, expect, type Page } from '@playwright/test'

/**
 * Session handling: where the access token lives, whether a reload survives, and
 * what is left behind when a user signs out.
 *
 * The third test exists because of a real incident: on production two owners of
 * *different* clinics both saw the same clinic name in the sidebar, because the
 * query cache outlived the logout.
 */

const SMILE = {
  email: 'tiro.eldin@gmail.com',
  password: 'Tmp_996dd03a6efa428c900d75bf00ccd420!A1',
  clinic: 'Smile :)))',
  /** Exists only in this clinic, so seeing it elsewhere proves a cache leak. */
  onlyStaff: 'Dr SmileOnly',
}

const PINK = {
  email: 'pink@dentflow.local',
  password: 'Tmp_ebeb16502fe54a8ca15144ad6b230c61!A1',
  clinic: 'Pink Dent',
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /odjavi se|sign out|abmelden/i }).click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
}

/** Everything the app persisted, so a test can assert on what a stolen disk would hold. */
async function persistedStorage(page: Page) {
  return page.evaluate(() => ({
    local: Object.fromEntries(
      Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? '']),
    ),
    session: Object.fromEntries(
      Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k) ?? '']),
    ),
  }))
}

test('keeps the access token out of persistent storage', async ({ page }) => {
  await login(page, SMILE)

  const stored = await persistedStorage(page)
  const blob = JSON.stringify(stored)

  // A JWT is unmistakable: three base64 segments starting with the alg header.
  expect(blob, 'no JWT may be written to localStorage or sessionStorage')
    .not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./)

  expect(Object.keys(stored.local), 'the old persisted auth key must be gone')
    .not.toContain('pearldesk-auth')
})

test('clears a token left behind by an earlier build', async ({ page }) => {
  // Users who ran the persisted-token build still carry one; dropping the
  // persistence does not remove what is already on their disk.
  await page.goto('/login')
  await page.evaluate(() =>
    localStorage.setItem(
      'pearldesk-auth',
      JSON.stringify({ state: { accessToken: 'eyJhbGciOiJIUzI1NiJ9.stale.token' }, version: 0 }),
    ),
  )

  await page.reload()
  await page.waitForTimeout(1500)

  const leftover = await page.evaluate(() => localStorage.getItem('pearldesk-auth'))
  expect(leftover, 'the legacy auth key must be purged on boot').toBeNull()
})

test('survives a page reload', async ({ page }) => {
  await login(page, SMILE)
  await expect(page.getByText(SMILE.clinic)).toBeVisible({ timeout: 15000 })

  await page.reload()

  // With the token held in memory only, this can work solely by exchanging the
  // refresh cookie on boot.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  await expect(page.getByText(SMILE.clinic)).toBeVisible({ timeout: 15000 })
})

test('does not show the previous user clinic after switching accounts', async ({ page }) => {
  await login(page, SMILE)
  await expect(page.getByText(SMILE.clinic)).toBeVisible({ timeout: 15000 })

  await logout(page)
  await login(page, PINK)

  await expect(
    page.getByText(PINK.clinic),
    'the second user must see their own clinic, not the first user cached one',
  ).toBeVisible({ timeout: 15000 })

  await expect(
    page.getByText(SMILE.clinic),
    'no trace of the previous tenant may survive the logout',
  ).toHaveCount(0)
})

test('does not serve the previous clinic cached data to the next user', async ({ page }) => {
  // The sidebar name refetches immediately (staleTime 0), so it self-corrects and
  // hides the problem. The real exposure is in the queries that deliberately do not
  // refetch: staff-all-active holds for 5 minutes, dashboard-stats for 1, and
  // patients-search for 30 seconds. Those keep serving the old tenant's rows.
  await login(page, SMILE)
  await expect(page.getByText(SMILE.clinic)).toBeVisible({ timeout: 15000 })
  // Rendered in more than one place (staff list and the slot picker), hence first().
  await expect(
    page.getByText(SMILE.onlyStaff).first(),
    'precondition: the first clinic has a doctor the second one does not',
  ).toBeVisible({ timeout: 15000 })

  await logout(page)
  await login(page, PINK)

  await expect(page.getByText(PINK.clinic)).toBeVisible({ timeout: 15000 })
  await expect(
    page.getByText(SMILE.onlyStaff),
    'the second clinic must never see a doctor belonging to the first',
  ).toHaveCount(0)
})

test('recovers from an expired access token without bouncing the user', async ({ page }) => {
  await login(page, SMILE)

  let refreshCalls = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/auth/refresh')) refreshCalls++
  })

  // Fail the next data call once, the way an expired token would.
  let forced = false
  await page.route('**/api/v1/patients**', async (route) => {
    if (forced) return route.continue()
    forced = true
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  await page.getByRole('link', { name: /pacijenti|patients/i }).first().click()

  await expect(
    page.getByRole('heading', { name: /pacijenti|patients/i }).first(),
    'a 401 mid-session must be refreshed and retried, not dumped on /login',
  ).toBeVisible({ timeout: 15000 })

  await expect(page).not.toHaveURL(/\/login/)
  expect(refreshCalls, 'the interceptor should have refreshed exactly once').toBe(1)
})

test('refreshes only once when several calls fail together', async ({ page }) => {
  await login(page, SMILE)
  await page.waitForTimeout(1500) // let the initial queries settle

  // Counted only from here: a page reload would also refresh on boot, which would
  // muddle what this test is actually measuring.
  let refreshCalls = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/auth/refresh')) refreshCalls++
  })

  // Every data call fails its first attempt, mimicking a token that expired while
  // a screen with several queries was loading.
  const failedOnce = new Set<string>()
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/') || failedOnce.has(url)) return route.continue()
    failedOnce.add(url)
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  })

  // Client-side navigation, so several queries fire at once without a page boot.
  await page.getByRole('link', { name: /pacijenti|patients/i }).first().click()
  await page.getByRole('link', { name: /početna|home|dashboard/i }).first().click()
  await page.waitForTimeout(4000)

  // More than one rotates the cookie repeatedly, and a rotation racing the
  // browser's Set-Cookie sends a spent token — read as reuse, family revoked.
  expect(refreshCalls, 'a batch of 401s must share a single refresh').toBeLessThanOrEqual(1)
  await expect(page).not.toHaveURL(/\/login/)
})

test('revokes the session on the server when logging out', async ({ page }) => {
  await login(page, SMILE)
  await logout(page)

  // The refresh cookie is HttpOnly and scoped to /api/v1/auth, so the browser
  // attaches it automatically if it is still there.
  const status = await page.evaluate(async () => {
    const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    return r.status
  })

  expect(status, 'logging out must make the refresh token unusable').toBe(401)
})
