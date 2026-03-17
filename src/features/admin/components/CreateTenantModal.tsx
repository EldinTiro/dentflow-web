import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantService, type TenantCreatedResponse } from '../services/tenantService'

const schema = z.object({
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers, hyphens only'),
  name: z.string().min(1).max(200),
  plan: z.enum(['Free', 'Pro', 'Enterprise']),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
})

type FormValues = z.infer<typeof schema>

interface Props {
  onClose: () => void
}

export function CreateTenantModal({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [created, setCreated] = useState<TenantCreatedResponse | null>(null)
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2 MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'Free' },
  })

  const mutation = useMutation({
    mutationFn: tenantService.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setCreated(data)
    },
  })

  function onSubmit(values: FormValues) {
    mutation.mutate({ ...values, logoBase64 })
  }

  if (created) {
    return (
      <ModalShell title="Tenant Created" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Tenant <strong>{created.name}</strong> created successfully.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="font-semibold text-amber-800 mb-1">Save this temporary password</p>
            <p className="text-gray-700 text-xs mb-1">
              Owner email: <span className="font-mono font-medium">{created.ownerEmail}</span>
            </p>
            <p className="text-gray-700 text-xs">
              Temporary password:{' '}
              <span className="font-mono font-medium bg-white px-1 rounded border border-amber-200">
                {created.tempPassword}
              </span>
            </p>
            <p className="text-amber-700 text-xs mt-2">
              This password will not be shown again.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-2 bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="New Tenant" onClose={onClose}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 text-sm"
      >
        <Field label="Slug" error={errors.slug?.message}>
          <input
            {...register('slug')}
            placeholder="my-clinic"
            className="input"
          />
        </Field>
        <Field label="Practice Name" error={errors.name?.message}>
          <input {...register('name')} placeholder="Bright Smile Dental" className="input" />
        </Field>
        <Field label="Plan" error={errors.plan?.message}>
          <select {...register('plan')} className="input">
            <option>Free</option>
            <option>Pro</option>
            <option>Enterprise</option>
          </select>
        </Field>
        <Field label="Owner Email" error={errors.ownerEmail?.message}>
          <input {...register('ownerEmail')} type="email" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" error={errors.ownerFirstName?.message}>
            <input {...register('ownerFirstName')} className="input" />
          </Field>
          <Field label="Last Name" error={errors.ownerLastName?.message}>
            <input {...register('ownerLastName')} className="input" />
          </Field>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Clinic Logo (optional)</label>
          <div className="flex items-center gap-3">
            {logoBase64 && (
              <img src={logoBase64} alt="Logo preview" className="h-12 w-12 object-contain rounded border border-gray-200 bg-gray-50" />
            )}
            <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50">
              {logoBase64 ? 'Change' : 'Upload image'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
            </label>
            {logoBase64 && (
              <button type="button" onClick={() => setLogoBase64(undefined)} className="text-xs text-red-500 hover:text-red-700">
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG or SVG — max 2 MB</p>
        </div>

        {mutation.isError && (
          <p className="text-red-500 text-xs">Failed to create tenant. Please try again.</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
