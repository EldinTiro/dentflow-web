import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from '@/shared/components/Drawer'
import {
  patientService,
  type PatientResponse,
  type UpdatePatientRequest,
  type Gender,
  type ContactMethod,
} from '../services/patientService'

interface FormValues {
  firstName: string
  lastName: string
  preferredName: string
  pronouns: string
  dateOfBirth: string
  gender: Gender | ''
  email: string
  phoneMobile: string
  phoneHome: string
  phoneWork: string
  preferredContactMethod: ContactMethod | ''
  addressLine1: string
  addressLine2: string
  city: string
  stateProvince: string
  postalCode: string
  countryCode: string
  occupation: string
  notes: string
  smsOptIn: boolean
  emailOptIn: boolean
}

interface Props {
  patient: PatientResponse
  onClose: () => void
}

export function EditPatientDrawer({ patient, onClose }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      preferredName: patient.preferredName ?? '',
      pronouns: '',
      dateOfBirth: patient.dateOfBirth ?? '',
      gender: (patient.gender as Gender) ?? '',
      email: patient.email ?? '',
      phoneMobile: patient.phoneMobile ?? '',
      phoneHome: patient.phoneHome ?? '',
      phoneWork: patient.phoneWork ?? '',
      preferredContactMethod: (patient.preferredContactMethod as ContactMethod) ?? '',
      addressLine1: patient.addressLine1 ?? '',
      addressLine2: patient.addressLine2 ?? '',
      city: patient.city ?? '',
      stateProvince: patient.stateProvince ?? '',
      postalCode: patient.postalCode ?? '',
      countryCode: patient.countryCode ?? '',
      occupation: '',
      notes: patient.notes ?? '',
      smsOptIn: patient.smsOptIn,
      emailOptIn: patient.emailOptIn,
    },
  })

  const update = useMutation({
    mutationFn: (values: FormValues) => {
      const body: UpdatePatientRequest = {
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || null,
        pronouns: values.pronouns || null,
        dateOfBirth: values.dateOfBirth || null,
        gender: (values.gender as Gender) || null,
        email: values.email || null,
        phoneMobile: values.phoneMobile || null,
        phoneHome: values.phoneHome || null,
        phoneWork: values.phoneWork || null,
        preferredContactMethod: (values.preferredContactMethod as ContactMethod) || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        stateProvince: values.stateProvince || null,
        postalCode: values.postalCode || null,
        countryCode: values.countryCode || null,
        occupation: values.occupation || null,
        smsOptIn: values.smsOptIn,
        emailOptIn: values.emailOptIn,
        notes: values.notes || null,
      }
      return patientService.update(patient.id, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
      onClose()
    },
  })

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
  const errorClass = 'text-xs text-red-500 mt-0.5'
  const sectionClass = 'pt-4 border-t border-gray-100'
  const sectionTitle = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'

  return (
    <Drawer title={`Edit — ${patient.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit((v) => update.mutate(v))} className="space-y-4">
        {/* Demographics */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input {...register('firstName', { required: 'Required' })} className={inputClass} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input {...register('lastName', { required: 'Required' })} className={inputClass} />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Preferred Name</label>
            <input {...register('preferredName')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Pronouns</label>
            <input {...register('pronouns')} className={inputClass} placeholder="e.g. she/her" />
          </div>
        </div>

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
        <div className={sectionClass}>
          <p className={sectionTitle}>Contact</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" {...register('email')} className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>Mobile</label>
                <input {...register('phoneMobile')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Home</label>
                <input {...register('phoneHome')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Work</label>
                <input {...register('phoneWork')} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Preferred Contact</label>
              <select {...register('preferredContactMethod')} className={inputClass}>
                <option value="">Select…</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Sms">SMS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className={sectionClass}>
          <p className={sectionTitle}>Address</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Address Line 1</label>
              <input {...register('addressLine1')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Address Line 2</label>
              <input {...register('addressLine2')} className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>City</label>
                <input {...register('city')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State/Province</label>
                <input {...register('stateProvince')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Postal Code</label>
                <input {...register('postalCode')} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Country Code</label>
              <input {...register('countryCode')} className={inputClass} placeholder="e.g. US" />
            </div>
          </div>
        </div>

        {/* Other */}
        <div className={sectionClass}>
          <p className={sectionTitle}>Other</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Occupation</label>
              <input {...register('occupation')} className={inputClass} />
            </div>
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
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
        </div>

        {update.isError && (
          <p className="text-sm text-red-600">Failed to save changes. Please try again.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={update.isPending}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save Changes'}
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
