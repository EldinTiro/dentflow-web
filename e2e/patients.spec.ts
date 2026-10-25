import { test, expect } from '@playwright/test'
import { account, login, runId } from './support'

/**
 * People-merge plan B8: every clinic role manages patients, and patients are
 * deactivated instead of deleted.
 */
test.describe.configure({ mode: 'serial' })

const last = `Patient${runId()}`

test('a receptionist creates, edits, deactivates and reactivates a patient', async ({ page }) => {
  await login(page, account('RECEPTIONIST'))

  await page.goto('/patients')
  await page.getByRole('button', { name: /new patient/i }).click()
  await page.getByPlaceholder('Jane').fill('E2e')
  await page.getByPlaceholder('Doe').fill(last)
  await page.getByRole('button', { name: /create patient/i }).click()

  await page.getByPlaceholder(/search by name/i).fill(last)
  await page.getByText(`E2e ${last}`).click()
  await expect(page.getByRole('heading', { name: `E2e ${last}` })).toBeVisible()

  await page.getByRole('button', { name: /^edit$/i }).click()
  await page.getByRole('dialog').or(page.locator('form')).locator('input[name="firstName"]').last().fill('E2e2')
  await page.getByRole('button', { name: /^save/i }).click()
  await expect(page.getByRole('heading', { name: `E2e2 ${last}` })).toBeVisible()

  await page.getByRole('button', { name: /^deactivate$/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/reason/i).fill('E2E: moved away')
  await dialog.getByRole('button', { name: /^deactivate$/i }).click()
  const banner = page.getByRole('status').filter({ hasText: /inactive/i })
  await expect(banner).toContainText('E2E: moved away')

  // Gone from the default (Active) list, still one filter away
  await page.goto(`/patients?search=${last}`)
  await expect(page.getByText(`E2e2 ${last}`)).toHaveCount(0)
  await page.getByLabel(/status filter/i).selectOption('Inactive')
  await page.getByText(`E2e2 ${last}`).click()

  await page.getByRole('status').getByRole('button', { name: /reactivate/i }).click()
  await expect(page.getByRole('status').filter({ hasText: /inactive/i })).toHaveCount(0)
})

test('a deactivated patient is not offered when booking', async ({ page }) => {
  await login(page, account('RECEPTIONIST'))

  await page.goto(`/patients?search=${last}`)
  await page.getByText(`E2e2 ${last}`).click()
  await page.getByRole('button', { name: /^deactivate$/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^deactivate$/i }).click()
  await expect(page.getByRole('status').filter({ hasText: /inactive/i })).toBeVisible()

  await page.goto('/appointments')
  await page.getByRole('button', { name: /book appointment/i }).first().click()
  await page.getByLabel(/^patient/i).fill(last)
  await page.waitForTimeout(800) // debounced search
  await expect(page.getByText(`E2e2 ${last}`)).toHaveCount(0)
})
