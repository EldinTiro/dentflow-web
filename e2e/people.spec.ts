import { test, expect } from '@playwright/test'
import { account, login, logout, expectLoginRefused, runId } from './support'

/**
 * People-merge plan Phase 5 + B8: a person is a staff profile; signing in is an option
 * on it. Runs serially — each step builds on the dentist created in the first.
 */
test.describe.configure({ mode: 'serial' })

const id = runId()
const dentist = { first: 'E2e', last: `Dentist${id}`, email: `e2e-dentist-${id}@dentflow.test` }
const newPassword = `E2e!${id}Aa9xyz`
let tempPassword = ''

test('owner adds a dentist who can sign in, and the dentist must change the password', async ({ page }) => {
  const owner = account('OWNER')
  await login(page, owner)

  await page.goto('/staff')
  await page.getByRole('button', { name: /add staff/i }).click()
  await page.getByLabel(/first name/i).fill(dentist.first)
  await page.getByLabel(/last name/i).fill(dentist.last)
  await page.getByLabel(/^staff type/i).selectOption('Dentist')
  await page.getByLabel(/^email/i).fill(dentist.email)
  await page.getByRole('checkbox', { name: /can sign in/i }).check()
  await page.getByLabel(/^role/i).selectOption('Dentist')
  await page.getByRole('button', { name: /add staff member/i }).click()

  tempPassword = (await page.locator('code').first().textContent())?.trim() ?? ''
  expect(tempPassword).not.toBe('')
  await page.getByRole('button', { name: /^done$/i }).click()
  await logout(page)

  await login(page, { email: dentist.email, password: tempPassword })
  await expect(page).toHaveURL(/\/change-password/)
  await page.locator('#currentPassword').fill(tempPassword)
  await page.locator('#newPassword').fill(newPassword)
  await page.locator('#confirmPassword').fill(newPassword)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  await logout(page)
})

test('owner deactivates the dentist: no longer bookable, and sign-in is refused', async ({ page }) => {
  const owner = account('OWNER')
  await login(page, owner)

  await page.goto('/staff')
  await page.getByPlaceholder(/search/i).fill(dentist.last)
  await page.getByText(`${dentist.first} ${dentist.last}`).click()
  await page.getByRole('button', { name: /^deactivate$/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^deactivate$/i }).click()
  await expect(page.getByRole('button', { name: /^reactivate$/i })).toBeVisible()

  await page.goto('/appointments')
  await page.getByRole('button', { name: /book appointment/i }).first().click()
  await expect(page.getByLabel(/^provider/i).locator('option', { hasText: dentist.last })).toHaveCount(0)
  await logout(page)

  await expectLoginRefused(page, { email: dentist.email, password: newPassword })
})

test('the old Team address ends on Staff', async ({ page }) => {
  await login(page, account('OWNER'))

  await page.goto('/settings/users')

  await expect(page).toHaveURL(/\/staff$/)
  await expect(page.getByRole('link', { name: 'Team' })).toHaveCount(0)
})

test('a receptionist sees Staff but no access or staff controls', async ({ page }) => {
  await login(page, account('RECEPTIONIST'))

  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: 'Staff', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /add staff/i })).toHaveCount(0)

  await page.locator('tbody tr').first().click()
  const access = page.getByRole('region', { name: /app access/i })
  await expect(access).toBeVisible()
  await expect(access.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^deactivate$/i })).toHaveCount(0)
})
