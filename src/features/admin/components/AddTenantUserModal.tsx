import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
          <h2 className="text-lg font-bold text-gray-900 mb-1">User Created!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Account added to <strong>{tenantName}</strong>.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-2">
            <div>
              <p className="text-xs text-amber-700 font-medium">Email</p>
              <p className="text-sm font-mono text-gray-800">{created.email}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium">Temporary Password</p>
              <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-amber-200 break-all">
                {created.tempPassword}
              </p>
            </div>
            <p className="text-xs text-amber-600">This password will not be shown again.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Done
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
            <h2 className="text-lg font-bold text-gray-900">Add User</h2>
            <p className="text-xs text-gray-400 mt-0.5">{tenantName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit((v) => provision.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input
                {...register('firstName', { required: 'Required' })}
                placeholder="Jane"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-0.5">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input
                {...register('lastName', { required: 'Required' })}
                placeholder="Smith"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-0.5">{errors.lastName.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                {...register('email', { required: 'Required' })}
                type="email"
                placeholder="jane@clinic.com"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                {...register('role')}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TENANT_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {provision.isError && (
            <p className="text-xs text-red-500">Failed to create user. The email may already be registered.</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={provision.isPending}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {provision.isPending ? 'Creating…' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
