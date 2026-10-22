import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useAuthStore } from '../store/authStore'
import { userService } from '../services/userService'

interface Props {
  firstName: string
  lastName: string
}

const INPUT =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'

/** The user's own name — it could not be changed at all before (QA-037). */
export function EditNameForm({ firstName, lastName }: Props) {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm({ values: { firstName, lastName } })

  const save = useMutation({
    mutationFn: (body: { firstName: string; lastName: string }) => userService.updateProfile(body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['user-profile'], profile)
      // The sidebar reads the name from the auth store.
      const { accessToken, user } = useAuthStore.getState()
      if (accessToken && user) useAuthStore.getState().setAuth(accessToken, { ...user, fullName: profile.fullName })
      toast.success(tc('feedback.saved'))
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  const required = { validate: (v: string) => v.trim().length > 0 || tc('feedback.required') }

  return (
    <form noValidate
      onSubmit={handleSubmit((v) => save.mutate({ firstName: v.firstName.trim(), lastName: v.lastName.trim() }))}
      className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
    >
      <div>
        <label htmlFor="profile-first-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{t('profile.firstName')}</label>
        <input id="profile-first-name" className={INPUT} {...register('firstName', required)} />
        {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
      </div>
      <div>
        <label htmlFor="profile-last-name" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{t('profile.lastName')}</label>
        <input id="profile-last-name" className={INPUT} {...register('lastName', required)} />
        {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
      </div>
      <button type="submit" disabled={save.isPending}
        className="sm:mt-5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
        {tc('button.save')}
      </button>
    </form>
  )
}
