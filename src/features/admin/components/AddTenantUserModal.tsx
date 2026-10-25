import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { userAdminService } from '../services/userAdminService'
import { TempPasswordBox } from '@/shared/components/TempPasswordBox'
import { TENANT_ROLES } from '@/shared/lib/permissions'

interface FormValues {
  email: string
  firstName: string
  lastName: string
  role: string
}

interface Props {
  tenantId: string
  tenantName: string
  onClose: () => void
}

export function AddTenantUserModal({ tenantId, tenantName, onClose }: Props) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { role: 'Receptionist' },
  })

  const provision = useMutation({
    mutationFn: (values: FormValues) => userAdminService.provisionForTenant(tenantId, values),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', tenantId] })
      setCreated({ email: data.email, tempPassword: data.tempPassword })
    },
  })

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 mb-1 dark:text-gray-100">{t('tenant.users.addModal.successTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: t('tenant.users.addModal.successMessage', { tenantName }) }} />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-2 dark:bg-amber-400/10 dark:border-amber-400/30">
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('tenant.users.addModal.email')}</p>
              <p className="text-sm font-mono text-gray-800 dark:text-gray-200">{created.email}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('tenant.users.addModal.tempPassword')}</p>
              <TempPasswordBox password={created.tempPassword} />
            </div>
            <p className="text-xs text-amber-600">{t('tenant.users.addModal.tempPasswordWarning')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            {tc('button.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('tenant.users.addModal.title')}</h2>
            <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{tenantName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-xl leading-none dark:text-gray-400">×</button>
        </div>

        <form noValidate onSubmit={handleSubmit((v) => provision.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tenant-user-firstName" className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">{t('tenant.users.addModal.firstName')}</label>
              <input id="tenant-user-firstName"
                {...register('firstName', { required: 'Required' })}
                placeholder="Jane"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-0.5">{errors.firstName.message}</p>}
            </div>
            <div>
              <label htmlFor="tenant-user-lastName" className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">{t('tenant.users.addModal.lastName')}</label>
              <input id="tenant-user-lastName"
                {...register('lastName', { required: 'Required' })}
                placeholder="Smith"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-0.5">{errors.lastName.message}</p>}
            </div>
            <div className="col-span-2">
              <label htmlFor="tenant-user-email" className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">{t('tenant.users.addModal.emailLabel')}</label>
              <input id="tenant-user-email"
                {...register('email', { required: 'Required' })}
                type="email"
                placeholder="jane@clinic.com"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
            </div>
            <div className="col-span-2">
              <label htmlFor="tenant-user-role" className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">{t('tenant.users.addModal.roleLabel')}</label>
              <select id="tenant-user-role"
                {...register('role')}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {TENANT_ROLES.map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
              </select>
            </div>
          </div>

          {provision.isError && (
            <p className="text-xs text-red-500">{t('tenant.users.addModal.error')}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            >
              {tc('button.cancel')}
            </button>
            <button
              type="submit"
              disabled={provision.isPending}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {provision.isPending ? t('tenant.users.addModal.creating') : t('tenant.users.addModal.addButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
