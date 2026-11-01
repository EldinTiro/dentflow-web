import { expect, test, type Page } from '@playwright/test'

/**
 * Accounts for the people / patients specs come from the environment, never from the
 * repository: E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD (a ClinicOwner) and
 * E2E_RECEPTIONIST_EMAIL / E2E_RECEPTIONIST_PASSWORD (a Receptionist of the same clinic),
 * and for the session spec E2E_OTHER_OWNER_EMAIL / E2E_OTHER_OWNER_PASSWORD (the owner of a
 * second clinic). The accounts must have English as their language preference.
 * These repos are public: never write a password into a spec (SEC-01).
 */
export interface Account { email: string; password: string }

export function account(role: 'OWNER' | 'RECEPTIONIST' | 'OTHER_OWNER'): Account {
  const email = process.env[`E2E_${role}_EMAIL`]
  const password = process.env[`E2E_${role}_PASSWORD`]
  test.skip(!email || !password, `set E2E_${role}_EMAIL and E2E_${role}_PASSWORD to run this spec`)
  return { email: email!, password: password! }
}

export async function login(page: Page, user: Account) {
  await page.goto('/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
}

/** The login form's own error, without waiting for a navigation that won't come. */
export async function expectLoginRefused(page: Page, user: Account) {
  await page.goto('/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
}

/** Unique per run, so specs can be repeated against the same database. */
export const runId = () => Date.now().toString(36)
