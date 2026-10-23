import type { QueryClient } from '@tanstack/react-query'

/**
 * Every cached view that is derived from appointments. They use separate key roots
 * (the calendar is ['appointments-week', …], the dashboard ['appointments-today', …],
 * free slots ['slots', …]), so invalidating ['appointments'] alone leaves them stale.
 */
const APPOINTMENT_DERIVED = /^(appointments(-.+)?|appointment-history|patient-appointments|slots|dashboard-stats)$/

/** Call after any change to an appointment: book, reschedule, status change, cancel. */
export function invalidateAppointmentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0]
      return typeof root === 'string' && APPOINTMENT_DERIVED.test(root)
    },
  })
}
