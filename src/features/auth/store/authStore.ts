import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  userId: string
  email: string
  fullName: string
  roles: string[]
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ accessToken: token, user, isAuthenticated: true }),

      clearAuth: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),

      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    {
      name: 'pearldesk-auth',
    },
  ),
)
