/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Written in by the deploy (Dockerfile build args); empty on a local run. */
  readonly VITE_APP_COMMIT?: string
  readonly VITE_APP_BUILT_AT?: string
  /** "production" or "test". */
  readonly VITE_APP_ENV?: string
}
