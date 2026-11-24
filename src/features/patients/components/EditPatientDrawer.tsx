import { useForm, useController } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/shared/components/Drawer'
import { ChoiceChips, DrawerActions, FIELD_ERROR, FIELD_INPUT, FIELD_LABEL, FIELD_TEXTAREA, FormSection, Switch } from '@/shared/components/FormParts'
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
  const { field: genderField } = useController({ name: 'gender', control })
  const { field: contactField } = useController({ name: 'preferredContactMethod', control })
  const { field: smsField } = useController({ name: 'smsOptIn', control })
  const { field: emailOptField } = useController({ name: 'emailOptIn', control })

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

  const inputClass = FIELD_INPUT
  const labelClass = FIELD_LABEL
  const errorClass = FIELD_ERROR
  const FORM_ID = 'edit-patient-form'

  return (
    <Drawer
      title={t('drawer.editTitle', { name: patient.fullName })}
      onClose={onClose}
      footer={<DrawerActions formId={FORM_ID} cancelLabel={tc('button.cancel')} onCancel={onClose}
        submitLabel={update.isPending ? t('drawer.saving') : t('drawer.saveChanges')} pending={update.isPending} />}
    >
      {/* Laid out like the rest of the app (user request 2026-11-13): named groups, no drop-downs */}
      <form id={FORM_ID} noValidate onSubmit={handleSubmit((v) => update.mutate(v))} className="space-y-4">
        <FormSection title={t('drawer.sectionBasics')}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="patient-preferredName" className={labelClass}>{t('drawer.preferredName')}</label>
              <input id="patient-preferredName" {...register('preferredName')} className={inputClass} placeholder={t('drawer.nicknamePlaceholder')} />
            </div>
            <div>
              <label htmlFor="patient-parentName" className={labelClass}>{t('drawer.parentName')}</label>
              <input id="patient-parentName" {...register('parentName')} className={inputClass} placeholder={t('drawer.parentNamePlaceholder')} />
            </div>
          </div>
          <div>
            <label htmlFor="patient-dateOfBirth" className={labelClass}>{t('drawer.dateOfBirth')}</label>
            <input id="patient-dateOfBirth" type="date" {...register('dateOfBirth')} className={`${inputClass} sm:w-1/2`} />
          </div>
          <div>
            <p className={labelClass}>{t('field.gender')}</p>
            <ChoiceChips
              label={t('field.gender')}
              options={[
                { value: 'Male' as Gender | '', label: tc('gender.male') },
                { value: 'Female' as Gender | '', label: tc('gender.female') },
                { value: 'Other' as Gender | '', label: tc('gender.other') },
                { value: 'PreferNotToSay' as Gender | '', label: tc('gender.preferNotToSay') },
              ]}
              value={genderField.value}
              onChange={(v) => genderField.onChange(v === genderField.value ? '' : v)}
            />
          </div>
        </FormSection>

        <FormSection title={t('drawer.sectionContact')}>
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
          <div>
            <label htmlFor="patient-email" className={labelClass}>{t('drawer.email')}</label>
            <input id="patient-email" type="email" {...register('email')} className={inputClass} placeholder={t('drawer.emailPlaceholder')} />
          </div>
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
            <p className={labelClass}>{t('field.preferredContact')}</p>
            <ChoiceChips
              label={t('field.preferredContact')}
              options={[
                { value: 'Phone' as ContactMethod | '', label: tc('contactMethod.phone') },
                { value: 'Sms' as ContactMethod | '', label: tc('contactMethod.sms') },
                { value: 'Email' as ContactMethod | '', label: tc('contactMethod.email') },
              ]}
              value={contactField.value}
              onChange={(v) => contactField.onChange(v === contactField.value ? '' : v)}
            />
          </div>
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
            <Switch id="patient-smsOptIn" label={t('drawer.smsOptIn')} checked={smsField.value} onChange={smsField.onChange} />
            <Switch id="patient-emailOptIn" label={t('drawer.emailOptIn')} checked={emailOptField.value} onChange={emailOptField.onChange} />
          </div>
        </FormSection>

        <FormSection title={t('drawer.sectionAddress')}>
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
            <input id="patient-countryCode" {...register('countryCode')} className={`${inputClass} sm:w-1/3`} placeholder={t('drawer.countryCodePlaceholder')} />
          </div>
        </FormSection>

        <FormSection title={t('section.notes')}>
          <label htmlFor="patient-notes" className="sr-only">{t('section.notes')}</label>
          <textarea id="patient-notes" {...register('notes')} rows={3} className={FIELD_TEXTAREA} placeholder={t('drawer.notesPlaceholder')} />
        </FormSection>

        {update.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(update.error, t('error.updateFailed'))}</p>
        )}
      </form>
    </Drawer>
  )
}
