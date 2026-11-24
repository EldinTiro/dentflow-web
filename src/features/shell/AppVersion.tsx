import { useQuery } from '@tanstack/react-query'
import apiClient from '@/shared/api/client'
import { formatDateTime } from '@/shared/lib/format'

interface Build {
  commit: string | undefined
  builtAt: string | undefined
  /** "production" or "test"; written in by the deploy. */
  env: string | undefined
}

/** What the deploy wrote into this build (Dockerfile build args); a local run has none. */
const THIS_BUILD: Build = {
  commit: import.meta.env.VITE_APP_COMMIT || undefined,
  builtAt: import.meta.env.VITE_APP_BUILT_AT || undefined,
  env: import.meta.env.VITE_APP_ENV || undefined,
}

const short = (commit: string) => commit.slice(0, 7)
const day = (iso: string) => iso.slice(0, 10).split('-').join('.')

/**
 * The build running, small at the foot of the sidebar (user request 2026-11-13): which code a
 * clinic is on when they report something, and proof a deploy is live. Shown only where a
 * deploy wrote it; hovering names both builds, the web's and the API's.
 */
export function AppVersion({ build = THIS_BUILD }: { build?: Build }) {
  const { data: api } = useQuery({
    queryKey: ['app-version'],
    queryFn: () => apiClient.get<{ commit: string | null; builtAt: string | null }>('/api/v1/version').then((r) => r.data),
    enabled: !!build.commit,
    staleTime: Infinity,
  })
  if (!build.commit) return null

  const line = (name: string, commit: string, builtAt: string | null | undefined) =>
    `${name}: ${short(commit)}${builtAt ? `, ${formatDateTime(builtAt)}` : ''}`
  const title = [line('Web', build.commit, build.builtAt), api?.commit && line('API', api.commit, api.builtAt)]
    .filter(Boolean).join('\n')

  return (
    <p title={title} className="flex items-center gap-1.5 px-4 pb-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
      {build.env === 'test' && (
        <span className="rounded bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">TEST</span>
      )}
      <span>{build.builtAt ? `v${day(build.builtAt)} · ` : ''}{short(build.commit)}</span>
    </p>
  )
}
