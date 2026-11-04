import { useForm, useController } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/shared/components/Drawer'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { patientService, type CreatePatientRequest, type Gender, type PatientStatus } from '../services/patientService'
import { DialPicker, isPlausibleLocalNumber, joinPhone } from './PhoneField'

interface FormValues {
  patientNumber: string
  firstName: string
  lastName: string
  parentName: string
  preferredName: string
  dateOfBirth: string
  gender: Gender | ''
  email: string
  phoneDialCode: string
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
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
  const queryClient = useQueryClient()

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      patientNumber: '',
      status: 'Active',
      gender: '',
      phoneDialCode: '+387',
      dateOfBirth: '',
      smsOptIn: false,
      emailOptIn: false,
    },
  })

  const { field: dialField } = useController({ name: 'phoneDialCode', control })

  const create = useMutation({
    mutationFn: (values: FormValues) => {
      const body: CreatePatientRequest = {
        patientNumber: values.patientNumber || null,
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || null,
        parentName: values.parentName || null,
        dateOfBirth: values.dateOfBirth || null,
        gender: (values.gender as Gender) || null,
        email: values.email || null,
        phoneMobile: joinPhone(values.phoneDialCode, values.phoneMobile),
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

  const inputClass = 'w-full border border-control rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300'
  const errorClass = 'text-xs text-red-500 mt-0.5'

  return (
    <Drawer title={t('drawer.createTitle')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        {/* Patient Number (optional override) */}
        <div>
          <label htmlFor="patient-patientNumber" className={labelClass}>{t('drawer.patientNumber')} <span className="text-gray-500 font-normal dark:text-gray-400">{t('drawer.autoGenerate')}</span></label>
          <input id="patient-patientNumber"
            {...register('patientNumber')}
            className={inputClass}
            placeholder={t('drawer.patientNumberPlaceholder')}
          />
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="patient-firstName" className={labelClass}>{t('drawer.firstName')}</label>
            <input id="patient-firstName"
              {...register('firstName', { required: t('validation.required') })}
              className={inputClass}
              placeholder="Jane"
            />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="patient-lastName" className={labelClass}>{t('drawer.lastName')}</label>
            <input id="patient-lastName"
              {...register('lastName', { required: t('validation.required') })}
              className={inputClass}
              placeholder="Doe"
            />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="patient-preferredName" className={labelClass}>{t('drawer.preferredName')}</label>
          <input id="patient-preferredName" {...register('preferredName')} className={inputClass} placeholder={t('drawer.nicknamePlaceholder')} />
        </div>

        <div>
          <label htmlFor="patient-parentName" className={labelClass}>{t('drawer.parentName')}</label>
          <input id="patient-parentName" {...register('parentName')} className={inputClass} placeholder={t('drawer.parentNamePlaceholder')} />
        </div>

        {/* DOB + Gender */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="patient-dateOfBirth" className={labelClass}>{t('drawer.dateOfBirth')}</label>
            <input id="patient-dateOfBirth" type="date" {...register('dateOfBirth')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="patient-gender" className={labelClass}>{t('field.gender')}</label>
            <select id="patient-gender" {...register('gender')} className={inputClass}>
              <option value="">{tc('gender.select')}</option>
              <option value="Male">{tc('gender.male')}</option>
              <option value="Female">{tc('gender.female')}</option>
              <option value="Other">{tc('gender.other')}</option>
              <option value="PreferNotToSay">{tc('gender.preferNotToSay')}</option>
            </select>
          </div>
        </div>

        {/* Contact */}
        <div>
          <label htmlFor="patient-email" className={labelClass}>{t('drawer.email')}</label>
          <input id="patient-email" type="email" {...register('email')} className={inputClass} placeholder={t('drawer.emailPlaceholder')} />
        </div>
        <div>
          <label htmlFor="patient-phoneMobile" className={labelClass}>{t('drawer.mobilePhone')}</label>
          <div className="flex gap-2">
            <DialPicker value={dialField.value} onChange={dialField.onChange} />
            <input
              id="patient-phoneMobile"
              {...register('phoneMobile', {
                validate: (v) => isPlausibleLocalNumber(v) || t('validation.phone'),
              })}
              className={inputClass}
              placeholder={t('drawer.phonePlaceholder')}
            />
          </div>
          {errors.phoneMobile && <p className={errorClass}>{errors.phoneMobile.message}</p>}
        </div>

        {/* Opt-ins */}
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer dark:text-gray-300">
            <input type="checkbox" {...register('smsOptIn')} className="rounded" />
            {t('drawer.smsOptIn')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer dark:text-gray-300">
            <input type="checkbox" {...register('emailOptIn')} className="rounded" />
            {t('drawer.emailOptIn')}
          </label>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="patient-notes" className={labelClass}>{t('section.notes')}</label>
          <textarea id="patient-notes"
            {...register('notes')}
            rows={3}
            className={inputClass + ' resize-none'}
            placeholder={t('drawer.notesPlaceholder')}
          />
        </div>

        {create.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(create.error, t('error.createFailed'))}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex-1 bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {create.isPending ? t('drawer.creating') : t('drawer.createButton')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-control text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            {tc('button.cancel')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
