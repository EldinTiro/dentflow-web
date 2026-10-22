import { create } from 'zustand'

interface AuthUser {
  userId: string
  email: string
  fullName: string
  roles: string[]
  /** The password was set by someone else and must be replaced before using the app (QA-011). */
  mustChangePassword?: boolean
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  /** False until the boot-time refresh attempt settles, so guards do not bounce early. */
  isRestoring: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  finishRestoring: () => void
  hasRole: (role: string) => boolean
}

/**
 * Memory only — deliberately not persisted.
 *
 * The access token used to live in localStorage, which made any XSS a full token
 * theft. Session continuity across reloads now comes from the HttpOnly refresh
 * cookie instead: see restoreSession in authService.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isRestoring: true,

  setAuth: (token, user) =>
    set({ accessToken: token, user, isAuthenticated: true, isRestoring: false }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false, isRestoring: false }),

  finishRestoring: () => set({ isRestoring: false }),

  hasRole: (role) => get().user?.roles.includes(role) ?? false,
}))

const NO_ROLES: string[] = []

/**
 * Use this instead of `s.user?.roles ?? []`: a fresh [] on every call makes Zustand 5
 * re-render forever whenever nobody is signed in (e.g. right after logout).
 */
export const selectRoles = (s: AuthState): string[] => s.user?.roles ?? NO_ROLES
