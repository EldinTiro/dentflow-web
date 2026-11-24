import type { QueryClient } from '@tanstack/react-query'

/**
 * Everything an invoice change can make stale: the invoice and invoice lists, and the
 * patient's balance, timeline and list row (user report 2026-11-12: after paying, the
 * patient page showed the old balance for five minutes), plus finance figures.
 */
const BILLING_DERIVED = /^(invoice|invoices|patient-invoices|patient|patients|patient-timeline|finance(-.+)?|dashboard-finance)$/

export function invalidateBillingQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0]
      return typeof root === 'string' && BILLING_DERIVED.test(root)
    },
  })
}
