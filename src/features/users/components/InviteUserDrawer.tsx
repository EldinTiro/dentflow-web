import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/shared/components/Drawer'
import { userService, type InviteUserResult } from '../services/userService'

const TENANT_ROLES = [
  'ClinicOwner', 'ClinicAdmin', 'Dentist', 'Hygienist',
  'Receptionist', 'BillingStaff', 'ReadOnly',
]

interface FormValues {
  email: string
  firstName: string
  lastName: string
  role: string
}

interface Props {
  onClose: () => void
}

export function InviteUserDrawer({ onClose }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const [invited, setInvited] = useState<InviteUserResult | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { role: 'Receptionist' },
  })

  const invite = useMutation({
    mutationFn: (values: FormValues) => userService.invite(values),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] })
      setInvited(data)
    },
  })

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
  const errorClass = 'text-xs text-red-500 mt-0.5'

  if (invited) {
    return (
      <Drawer title={t('invite.successTitle')} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('invite.successMessage')}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('invite.email')}</p>
              <p className="text-sm font-mono text-gray-800 mt-0.5">{invited.email}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('invite.tempPassword')}</p>
              <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-amber-200 break-all mt-0.5">
                {invited.tempPassword}
              </p>
            </div>
            <p className="text-xs text-amber-600">{t('invite.tempPasswordWarning')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {tc('button.done')}
          </button>
        </div>
      </Drawer>
    )
  }

  return (
    <Drawer title={t('invite.title')} onClose={onClose}>
      <form onSubmit={handleSubmit((v) => invite.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('invite.firstName')}</label>
            <input
              {...register('firstName', { required: 'Required' })}
              className={inputClass}
              placeholder="Jane"
            />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>{t('invite.lastName')}</label>
            <input
              {...register('lastName', { required: 'Required' })}
              className={inputClass}
              placeholder="Smith"
            />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('invite.emailLabel')}</label>
          <input
            type="email"
            {...register('email', { required: 'Required' })}
            className={inputClass}
            placeholder="jane@clinic.com"
          />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelClass}>{t('invite.roleLabel')}</label>
          <select {...register('role')} className={inputClass}>
            {TENANT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {invite.isError && (
          <p className="text-sm text-red-600">{t('invite.error')}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={invite.isPending}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {invite.isPending ? t('invite.sending') : t('invite.sendButton')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            {tc('button.cancel')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
