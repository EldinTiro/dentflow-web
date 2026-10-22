import { useForm, useController } from 'react-hook-form'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Drawer } from '@/shared/components/Drawer'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { patientService, type CreatePatientRequest, type Gender, type PatientStatus } from '../services/patientService'

/**
 * The dial code is picked separately, so this is the local part: digits (spaces,
 * dashes, brackets allowed), 6–12 of them after a leading trunk 0 (QA-019).
 */
function isPlausibleLocalNumber(value: string): boolean {
  if (!value) return true
  if (!/^[\d\s\-()]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '').replace(/^0/, '')
  return digits.length >= 6 && digits.length <= 12
}

function countryFlag(code: string): string {
  if (code === 'XK') return '🏳'
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.codePointAt(0)! + 127397)).join('')
}

const COUNTRY_CODES = [
  { code: 'BA', dial: '+387', label: 'Bosnia and Herzegovina' },
  { code: 'US', dial: '+1',   label: 'United States' },
  { code: 'GB', dial: '+44',  label: 'United Kingdom' },
  { code: 'DE', dial: '+49',  label: 'Germany' },
  { code: 'FR', dial: '+33',  label: 'France' },
  { code: 'IT', dial: '+39',  label: 'Italy' },
  { code: 'ES', dial: '+34',  label: 'Spain' },
  { code: 'AT', dial: '+43',  label: 'Austria' },
  { code: 'CH', dial: '+41',  label: 'Switzerland' },
  { code: 'NL', dial: '+31',  label: 'Netherlands' },
  { code: 'BE', dial: '+32',  label: 'Belgium' },
  { code: 'SE', dial: '+46',  label: 'Sweden' },
  { code: 'NO', dial: '+47',  label: 'Norway' },
  { code: 'DK', dial: '+45',  label: 'Denmark' },
  { code: 'FI', dial: '+358', label: 'Finland' },
  { code: 'PL', dial: '+48',  label: 'Poland' },
  { code: 'CZ', dial: '+420', label: 'Czech Republic' },
  { code: 'SK', dial: '+421', label: 'Slovakia' },
  { code: 'HU', dial: '+36',  label: 'Hungary' },
  { code: 'RO', dial: '+40',  label: 'Romania' },
  { code: 'BG', dial: '+359', label: 'Bulgaria' },
  { code: 'HR', dial: '+385', label: 'Croatia' },
  { code: 'RS', dial: '+381', label: 'Serbia' },
  { code: 'ME', dial: '+382', label: 'Montenegro' },
  { code: 'MK', dial: '+389', label: 'North Macedonia' },
  { code: 'SI', dial: '+386', label: 'Slovenia' },
  { code: 'AL', dial: '+355', label: 'Albania' },
  { code: 'XK', dial: '+383', label: 'Kosovo' },
  { code: 'TR', dial: '+90',  label: 'Turkey' },
  { code: 'GR', dial: '+30',  label: 'Greece' },
  { code: 'PT', dial: '+351', label: 'Portugal' },
  { code: 'IE', dial: '+353', label: 'Ireland' },
  { code: 'CA', dial: '+1',   label: 'Canada' },
  { code: 'AU', dial: '+61',  label: 'Australia' },
  { code: 'NZ', dial: '+64',  label: 'New Zealand' },
  { code: 'AE', dial: '+971', label: 'UAE' },
  { code: 'SA', dial: '+966', label: 'Saudi Arabia' },
]

interface DialPickerProps {
  value: string
  onChange: (dial: string) => void
}

function DialPicker({ value, onChange }: DialPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = COUNTRY_CODES.find(c => c.dial === value && c.code === 'BA') ??
    COUNTRY_CODES.find(c => c.dial === value) ??
    COUNTRY_CODES[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 whitespace-nowrap dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
      >
        <span className="text-base leading-none">{countryFlag(selected.code)}</span>
        <span className="text-gray-700 dark:text-gray-300">{selected.dial}</span>
        <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-64 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-900 dark:border-gray-700">
          {COUNTRY_CODES.map(c => (
            <button
              key={`${c.code}-${c.dial}`}
              type="button"
              onClick={() => { onChange(c.dial); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800${
                c.dial === value && c.code === selected.code ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-base leading-none w-6 shrink-0">{countryFlag(c.code)}</span>
              <span className="font-medium w-12 shrink-0">{c.dial}</span>
              <span className="truncate text-gray-500 dark:text-gray-400">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
        phoneMobile: values.phoneMobile
          ? `${values.phoneDialCode}${values.phoneMobile.replace(/^0/, '')}`
          : null,
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

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
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
          <label htmlFor="patient-notes" className={labelClass}>Notes</label>
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
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            {tc('button.cancel')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
