import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against an already-running stack: API on :5199 and `npm run dev` on :5173,
 * with the local database seeded (see root CLAUDE.md).
 *
 * Serial by default — these specs log in and out of shared accounts, so parallel
 * workers would fight over the same session state.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
