import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError';
import { Drawer } from '@/shared/components/Drawer';
import { TempPasswordBox } from '@/shared/components/TempPasswordBox';
import { TENANT_ROLES, type TenantRole } from '@/shared/lib/permissions';
import {
  staffService,
  ALL_STAFF_TYPES,
  type CreateStaffRequest,
  type StaffMemberResponse,
} from '../services/staffService';

interface Props {
  onClose: () => void;
}

interface FormValues extends Omit<CreateStaffRequest, 'access'> {
  canSignIn: boolean;
  role: TenantRole;
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300';

/**
 * Adds a person once (people-merge plan 4.2). "Can sign in" also creates their account
 * in the same call; the temporary password is shown here, once.
 */
export function CreateStaffDrawer({ onClose }: Props) {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<StaffMemberResponse | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      staffType: 'Receptionist',
      colorHex: '#3B82F6',
      canSignIn: false,
      role: 'Receptionist',
    },
  });
  const canSignIn = watch('canSignIn');

  const mutation = useMutation({
    mutationFn: ({ canSignIn, role, ...profile }: FormValues) =>
      staffService.create(canSignIn ? { ...profile, access: { role } } : profile),
    onSuccess: (staff) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-all-active'] });
      if (staff.tempPassword) setCreated(staff);
      else onClose();
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync(values);
    } catch (err) {
      const codes = getApiErrorCodes(err);
      if (codes.has('Staff.AlreadyExists') || codes.has('DuplicateEmail') || codes.has('DuplicateUserName')) {
        setError('email', { message: t('create.emailTaken') });
      } else if (codes.has('Staff.EmailRequiredForAccess')) {
        setError('email', { message: t('create.emailRequiredForAccess') });
      } else {
        toast.error(getApiErrorMessage(err, t('create.failed')));
      }
    }
  }

  if (created?.tempPassword) {
    return (
      <Drawer title={t('create.successTitle')} onClose={onClose}>
        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('create.successMessage', { name: created.fullName ?? '' })}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3 dark:bg-amber-400/10 dark:border-amber-400/30">
            <p className="text-sm font-mono text-gray-800 dark:text-gray-200">{created.email}</p>
            <TempPasswordBox password={created.tempPassword} />
            <p className="text-xs text-amber-600">{t('create.tempPasswordWarning')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700"
          >
            {t('create.done')}
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer title={t('create.title')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        <div>
          <label htmlFor="staff-firstName" className={labelClass}>
            {t('create.firstName')} <span className="text-red-500">*</span>
          </label>
          <input id="staff-firstName" type="text" className={inputClass}
            {...register('firstName', { required: t('create.required') })} />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
        </div>

        <div>
          <label htmlFor="staff-lastName" className={labelClass}>
            {t('create.lastName')} <span className="text-red-500">*</span>
          </label>
          <input id="staff-lastName" type="text" className={inputClass}
            {...register('lastName', { required: t('create.required') })} />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
        </div>

        <div>
          <label htmlFor="staff-staffType" className={labelClass}>
            {t('create.staffType')} <span className="text-red-500">*</span>
          </label>
          <select id="staff-staffType" className={inputClass} {...register('staffType', { required: true })}>
            {ALL_STAFF_TYPES.map((type) => (
              <option key={type} value={type}>{t(`staffType.${type}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="staff-email" className={labelClass}>
            {t('create.email')}{canSignIn && <span className="text-red-500"> *</span>}
          </label>
          <input id="staff-email" type="email" className={inputClass} placeholder="staff@clinic.com"
            {...register('email', {
              validate: (v, values) => !values.canSignIn || !!v?.trim() || t('create.emailRequiredForAccess'),
            })} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        {/* Sign-in access (people-merge plan D1): the profile email becomes the login */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <label htmlFor="staff-canSignIn" className="flex items-start gap-2 cursor-pointer">
            <input id="staff-canSignIn" type="checkbox" className="mt-0.5" {...register('canSignIn')} />
            <span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('create.canSignIn')}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('create.canSignInHint')}</span>
            </span>
          </label>
          {canSignIn && (
            <div>
              <label htmlFor="staff-role" className={labelClass}>{t('create.role')}</label>
              <select id="staff-role" className={inputClass} {...register('role')}>
                {TENANT_ROLES.map((role) => (
                  <option key={role} value={role}>{tc(`role.${role}`)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="staff-phone" className={labelClass}>{t('create.phone')}</label>
          <input id="staff-phone" type="tel" className={inputClass} {...register('phone')} />
        </div>

        <div>
          <label htmlFor="staff-specialty" className={labelClass}>{t('create.specialty')}</label>
          <input id="staff-specialty" type="text" className={inputClass}
            placeholder={t('create.specialtyPlaceholder')} {...register('specialty')} />
        </div>

        <div>
          <label htmlFor="staff-hireDate" className={labelClass}>{t('create.hireDate')}</label>
          <input id="staff-hireDate" type="date" className={inputClass} {...register('hireDate')} />
        </div>

        <div>
          <label htmlFor="staff-colorHex" className={labelClass}>{t('create.color')}</label>
          <input id="staff-colorHex" type="color" {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer dark:border-gray-600" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            {t('create.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? t('create.saving') : t('create.submit')}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
