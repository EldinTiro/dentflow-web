import apiClient from '@/shared/api/client'

export interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  lastLoginAt: string | null
}

export interface UserPreferences {
  theme: string
  language: string
  timeFormat: string
  defaultCalendarView: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export const userService = {
  getProfile: () =>
    apiClient.get<UserProfile>('/api/v1/users/me').then((r) => r.data),

  getPreferences: () =>
    apiClient.get<UserPreferences>('/api/v1/users/me/preferences').then((r) => r.data),

  updatePreferences: (prefs: UserPreferences) =>
    apiClient.put('/api/v1/users/me/preferences', prefs),

  changePassword: (req: ChangePasswordRequest) =>
    apiClient.post('/api/v1/users/me/change-password', req),
}
