import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService, UserPreferences } from '../services/userService'

export function useUserPreferences() {
  return useQuery({
    queryKey: ['user-preferences'],
    queryFn: userService.getPreferences,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: userService.updatePreferences,
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<UserPreferences>(['user-preferences'], variables)
    },
  })
}
