/**
 * Extracts the tenant slug from the current hostname.
 * e.g. "brightsmile.pearldesk.com" → "brightsmile"
 * Falls back to "localhost" slug for local development.
 */
export function getTenantSlug(): string {
  const hostname = window.location.hostname

  // Local dev: use a default or environment-provided slug
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT_SLUG ?? 'demo'
  }

  // Production: first subdomain segment is the slug
  const parts = hostname.split('.')
  return parts[0]
}
