import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { userAdminService } from '../services/userAdminService'

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
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">{t('tenant.users.addModal.successTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4" dangerouslySetInnerHTML={{ __html: t('tenant.users.addModal.successMessage', { tenantName }) }} />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-2">
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('tenant.users.addModal.email')}</p>
              <p className="text-sm font-mono text-gray-800">{created.email}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium">{t('tenant.users.addModal.tempPassword')}</p>
              <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-amber-200 break-all">
                {created.tempPassword}
              </p>
            </div>
            <p className="text-xs text-amber-600">{t('tenant.users.addModal.tempPasswordWarning')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            {tc('button.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('tenant.users.addModal.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{tenantName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit((v) => provision.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tenant.users.addModal.firstName')}</label>
              <input
                {...register('firstName', { required: 'Required' })}
                placeholder="Jane"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-0.5">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tenant.users.addModal.lastName')}</label>
              <input
                {...register('lastName', { required: 'Required' })}
                placeholder="Smith"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-0.5">{errors.lastName.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tenant.users.addModal.emailLabel')}</label>
              <input
                {...register('email', { required: 'Required' })}
                type="email"
                placeholder="jane@clinic.com"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tenant.users.addModal.roleLabel')}</label>
              <select
                {...register('role')}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TENANT_ROLES.map((r) => <option key={r}>{r}</option>)}
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
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              {tc('button.cancel')}
            </button>
            <button
              type="submit"
              disabled={provision.isPending}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {provision.isPending ? t('tenant.users.addModal.creating') : t('tenant.users.addModal.addButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
