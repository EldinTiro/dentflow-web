import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from '@/shared/components/Drawer'
import { patientService, type CreatePatientRequest, type Gender, type PatientStatus } from '../services/patientService'

interface FormValues {
  firstName: string
  lastName: string
  preferredName: string
  dateOfBirth: string
  gender: Gender | ''
  email: string
  phoneMobile: string
  status: PatientStatus
  notes: string
  smsOptIn: boolean
  emailOptIn: boolean
}

interface Props {
  onClose: () => void
}

export function CreatePatientDrawer({ onClose }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      status: 'Active',
      gender: '',
      smsOptIn: false,
      emailOptIn: false,
    },
  })

  const create = useMutation({
    mutationFn: (values: FormValues) => {
      const body: CreatePatientRequest = {
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || null,
        dateOfBirth: values.dateOfBirth || null,
        gender: (values.gender as Gender) || null,
        email: values.email || null,
        phoneMobile: values.phoneMobile || null,
        smsOptIn: values.smsOptIn,
        emailOptIn: values.emailOptIn,
        notes: values.notes || null,
      }
      return patientService.create(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      onClose()
    },
  })

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
  const errorClass = 'text-xs text-red-500 mt-0.5'

  return (
    <Drawer title="New Patient" onClose={onClose}>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input
              {...register('firstName', { required: 'Required' })}
              className={inputClass}
              placeholder="Jane"
            />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input
              {...register('lastName', { required: 'Required' })}
              className={inputClass}
              placeholder="Doe"
            />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Preferred Name</label>
          <input {...register('preferredName')} className={inputClass} placeholder="Optional nickname" />
        </div>

        {/* DOB + Gender */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Date of Birth</label>
            <input type="date" {...register('dateOfBirth')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select {...register('gender')} className={inputClass}>
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="PreferNotToSay">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Contact */}
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" {...register('email')} className={inputClass} placeholder="jane@example.com" />
        </div>
        <div>
          <label className={labelClass}>Mobile Phone</label>
          <input {...register('phoneMobile')} className={inputClass} placeholder="+1 555 000 0000" />
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select {...register('status')} className={inputClass}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Opt-ins */}
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" {...register('smsOptIn')} className="rounded" />
            SMS opt-in
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" {...register('emailOptIn')} className="rounded" />
            Email opt-in
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            className={inputClass + ' resize-none'}
            placeholder="Optional notes…"
          />
        </div>

        {create.isError && (
          <p className="text-sm text-red-600">Failed to create patient. Please try again.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create Patient'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  )
}
