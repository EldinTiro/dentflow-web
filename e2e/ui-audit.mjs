// Exploratory UI audit — collects evidence, asserts nothing.
// Faza 0.8 of documentation/STRATEGY.md. Not a test suite; see Faza 3 for that.
//
// Usage: node e2e/ui-audit.mjs   (API on :5199 and dev server on :5173 must be up)

import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFileSync } from 'node:fs'

const WEB = process.env.AUDIT_WEB ?? 'http://localhost:5173'
const API = process.env.AUDIT_API ?? 'http://localhost:5199'
const EMAIL = process.env.AUDIT_EMAIL ?? 'superadmin@DentFlow.local'
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'SuperAdmin123!@#'

const IDS = {
  patient: process.env.AUDIT_PATIENT_ID ?? '',
  staff: process.env.AUDIT_STAFF_ID ?? '',
  invoice: process.env.AUDIT_INVOICE_ID ?? '',
  tenant: process.env.AUDIT_TENANT_ID ?? '',
}

const ROUTES = [
  { path: '/login', name: 'Login', anon: true },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/patients', name: 'Patients list' },
  { path: '/appointments', name: 'Appointments' },
  { path: '/invoices', name: 'Invoices list' },
  { path: '/staff', name: 'Staff list' },
  { path: '/settings/users', name: 'Settings — users' },
  { path: '/settings/appointment-types', name: 'Settings — appointment types' },
  { path: '/settings/profile', name: 'Settings — profile' },
  { path: '/admin', name: 'Admin dashboard' },
  { path: '/admin/tenants', name: 'Admin — tenants' },
  { path: '/admin/users', name: 'Admin — users' },
  IDS.patient && { path: `/patients/${IDS.patient}`, name: 'Patient detail' },
  IDS.staff && { path: `/staff/${IDS.staff}`, name: 'Staff detail' },
  IDS.invoice && { path: `/invoices/${IDS.invoice}`, name: 'Invoice detail' },
  IDS.tenant && { path: `/admin/tenants/${IDS.tenant}`, name: 'Admin — tenant detail' },
].filter(Boolean)

async function getToken() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.json()
}

const findings = []
function add(route, kind, detail, severity = 'medium') {
  findings.push({ route: route.name, path: route.path, kind, detail, severity })
}

const auth = await getToken()
console.log(`logged in as ${auth.email} [${auth.roles.join(', ')}]`)

// The app reads its session from localStorage (key pearldesk-auth) via zustand
// persist, so seeding it is more robust than driving the login form.
const persisted = JSON.stringify({
  state: {
    accessToken: auth.accessToken,
    user: {
      userId: auth.userId,
      email: auth.email,
      fullName: auth.fullName,
      roles: auth.roles,
    },
    isAuthenticated: true,
  },
  version: 0,
})

const browser = await chromium.launch()

for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  if (!route.anon) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      ['pearldesk-auth', persisted],
    )
  }
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') add(route, 'console-error', msg.text().slice(0, 300), 'high')
    if (msg.type() === 'warning' && /missingKey|i18n/i.test(msg.text()))
      add(route, 'i18n-missing-key', msg.text().slice(0, 300), 'low')
  })
  page.on('pageerror', (err) => add(route, 'page-error', String(err).slice(0, 300), 'high'))
  page.on('response', (res) => {
    const s = res.status()
    if (s >= 400 && res.url().includes('/api/'))
      add(route, 'network-error', `${s} ${res.request().method()} ${res.url().replace(API, '')}`, s >= 500 ? 'high' : 'medium')
  })

  try {
    await page.goto(`${WEB}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1200)

    const landedOn = new URL(page.url()).pathname
    if (!route.anon && landedOn === '/login')
      add(route, 'auth-redirect', 'Redirected to /login — session not accepted', 'high')

    // Accessibility
    try {
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      for (const v of axe.violations) {
        add(route, 'a11y', `${v.id} (${v.impact}) — ${v.help} [${v.nodes.length} node(s)]`,
          v.impact === 'critical' || v.impact === 'serious' ? 'high' : 'low')
      }
    } catch (e) {
      add(route, 'audit-error', `axe failed: ${String(e).slice(0, 150)}`, 'low')
    }

    // Mobile overflow
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(600)
    const overflow = await page.evaluate(() => {
      const d = document.documentElement
      return { scroll: d.scrollWidth, client: d.clientWidth }
    })
    if (overflow.scroll > overflow.client + 2)
      add(route, 'mobile-overflow', `horizontal scroll at 390px: ${overflow.scroll}px content in ${overflow.client}px viewport`, 'medium')

    // Empty-state sanity: a page with a table but no rows and no message
    const emptyish = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr').length
      const hasTable = !!document.querySelector('table')
      const text = (document.body.innerText || '').trim()
      return { hasTable, rows, textLength: text.length }
    })
    if (emptyish.hasTable && emptyish.rows === 0 && emptyish.textLength < 400)
      add(route, 'empty-state', 'table present with zero rows and little surrounding copy — likely a bare empty state', 'low')

    await page.screenshot({ path: `e2e/audit-shots/${route.path.replace(/[^a-z0-9]/gi, '_')}.png`, fullPage: false }).catch(() => {})
  } catch (e) {
    add(route, 'navigation-failed', String(e).slice(0, 250), 'high')
  }

  await context.close()
  console.log(`  ${route.path} — ${findings.filter((f) => f.path === route.path).length} finding(s)`)
}

await browser.close()

writeFileSync('e2e/audit-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), routes: ROUTES.length, findings }, null, 2))

const byKind = findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {})
console.log('\n=== SUMMARY ===')
console.log(`routes audited: ${ROUTES.length}`)
console.log(`findings: ${findings.length}`)
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
