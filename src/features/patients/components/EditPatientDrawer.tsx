import { useForm, useController } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/shared/components/Drawer'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import {
  patientService,
  type PatientResponse,
  type UpdatePatientRequest,
  type Gender,
  type ContactMethod,
} from '../services/patientService'
import { DialPicker, isPlausibleLocalNumber, joinPhone, splitPhone } from './PhoneField'

interface FormValues {
  firstName: string
  lastName: string
  preferredName: string
  parentName: string
  dateOfBirth: string
  gender: Gender | ''
  email: string
  phoneDialCode: string
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
  notes: string
  smsOptIn: boolean
  emailOptIn: boolean
}

interface Props {
  patient: PatientResponse
  onClose: () => void
}

/** Laid out like CreatePatientDrawer, with the fields only an edit has (other phones, address) below. */
export function EditPatientDrawer({ patient, onClose }: Props) {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const mobile = splitPhone(patient.phoneMobile)

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      preferredName: patient.preferredName ?? '',
      parentName: patient.parentName ?? '',
      dateOfBirth: patient.dateOfBirth ?? '',
      gender: patient.gender ?? '',
      email: patient.email ?? '',
      phoneDialCode: mobile.dial,
      phoneMobile: mobile.local,
      phoneHome: patient.phoneHome ?? '',
      phoneWork: patient.phoneWork ?? '',
      preferredContactMethod: patient.preferredContactMethod ?? '',
      addressLine1: patient.addressLine1 ?? '',
      addressLine2: patient.addressLine2 ?? '',
      city: patient.city ?? '',
      stateProvince: patient.stateProvince ?? '',
      postalCode: patient.postalCode ?? '',
      countryCode: patient.countryCode ?? '',
      notes: patient.notes ?? '',
      smsOptIn: patient.smsOptIn,
      emailOptIn: patient.emailOptIn,
    },
  })

  const { field: dialField } = useController({ name: 'phoneDialCode', control })

  const update = useMutation({
    mutationFn: (values: FormValues) => {
      const body: UpdatePatientRequest = {
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || null,
        parentName: values.parentName || null,
        dateOfBirth: values.dateOfBirth || null,
        gender: values.gender || null,
        email: values.email || null,
        phoneMobile: joinPhone(values.phoneDialCode, values.phoneMobile),
        phoneHome: values.phoneHome || null,
        phoneWork: values.phoneWork || null,
        preferredContactMethod: values.preferredContactMethod || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        stateProvince: values.stateProvince || null,
        postalCode: values.postalCode || null,
        countryCode: values.countryCode || null,
        // Not on this form, but an update replaces every field: send it back or it is cleared
        preferredProviderId: patient.preferredProviderId,
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

  const inputClass = 'w-full border border-control rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300'
  const errorClass = 'text-xs text-red-500 mt-0.5'
  const sectionClass = 'pt-4 border-t border-gray-100 dark:border-gray-800'
  const sectionTitle = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400'

  return (
    <Drawer title={t('drawer.editTitle', { name: patient.fullName })} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => update.mutate(v))} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="patient-firstName" className={labelClass}>{t('drawer.firstName')}</label>
            <input id="patient-firstName" {...register('firstName', { required: t('validation.required') })} className={inputClass} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="patient-lastName" className={labelClass}>{t('drawer.lastName')}</label>
            <input id="patient-lastName" {...register('lastName', { required: t('validation.required') })} className={inputClass} />
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

        {/* Other ways to reach the patient */}
        <div className={sectionClass}>
          <p className={sectionTitle}>{t('drawer.sectionContact')}</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="patient-phoneHome" className={labelClass}>{t('field.home')}</label>
                <input id="patient-phoneHome" type="tel" {...register('phoneHome')} className={inputClass} />
              </div>
              <div>
                <label htmlFor="patient-phoneWork" className={labelClass}>{t('field.work')}</label>
                <input id="patient-phoneWork" type="tel" {...register('phoneWork')} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="patient-preferredContact" className={labelClass}>{t('field.preferredContact')}</label>
              <select id="patient-preferredContact" {...register('preferredContactMethod')} className={inputClass}>
                <option value="">{tc('gender.select')}</option>
                <option value="Email">{tc('contactMethod.email')}</option>
                <option value="Phone">{tc('contactMethod.phone')}</option>
                <option value="Sms">{tc('contactMethod.sms')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className={sectionClass}>
          <p className={sectionTitle}>{t('drawer.sectionAddress')}</p>
          <div className="space-y-3">
            <div>
              <label htmlFor="patient-addressLine1" className={labelClass}>{t('field.addressLine1')}</label>
              <input id="patient-addressLine1" {...register('addressLine1')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="patient-addressLine2" className={labelClass}>{t('field.addressLine2')}</label>
              <input id="patient-addressLine2" {...register('addressLine2')} className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="patient-city" className={labelClass}>{t('field.city')}</label>
                <input id="patient-city" {...register('city')} className={inputClass} />
              </div>
              <div>
                <label htmlFor="patient-stateProvince" className={labelClass}>{t('field.stateProvince')}</label>
                <input id="patient-stateProvince" {...register('stateProvince')} className={inputClass} />
              </div>
              <div>
                <label htmlFor="patient-postalCode" className={labelClass}>{t('field.postalCode')}</label>
                <input id="patient-postalCode" {...register('postalCode')} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="patient-countryCode" className={labelClass}>{t('field.countryCode')}</label>
              <input id="patient-countryCode" {...register('countryCode')} className={inputClass} placeholder={t('drawer.countryCodePlaceholder')} />
            </div>
          </div>
        </div>

        {update.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(update.error, t('error.updateFailed'))}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={update.isPending}
            className="flex-1 bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {update.isPending ? t('drawer.saving') : t('drawer.saveChanges')}
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
