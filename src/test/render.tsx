import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper }) }
}

/** Shape of a FastEndpoints 400 as axios surfaces it. */
export function fastEndpointsError(reason: string, name = 'generalErrors', status = 400) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, errors: [{ name, reason }] } },
  })
}
