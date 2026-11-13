import { useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError';
import { Drawer } from '@/shared/components/Drawer';
import { ChoiceChips, ColourSwatches, DrawerActions, FIELD_ERROR, FIELD_INPUT, FIELD_LABEL, FormSection, Switch } from '@/shared/components/FormParts';
import { TempPasswordBox } from '@/shared/components/TempPasswordBox';
import { TENANT_ROLES, type TenantRole } from '@/shared/lib/permissions';
import {
  staffService,
  SELECTABLE_STAFF_TYPES,
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

const FORM_ID = 'create-staff-form';

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
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      staffType: 'Receptionist',
      colorHex: '#3B82F6',
      canSignIn: false,
      role: 'Staff',
    },
  });
  const { field: staffType } = useController({ name: 'staffType', control });
  const { field: colour } = useController({ name: 'colorHex', control });
  const { field: signIn } = useController({ name: 'canSignIn', control });
  const { field: role } = useController({ name: 'role', control });
  const canSignIn = signIn.value;

  const mutation = useMutation({
    mutationFn: ({ canSignIn, role, ...profile }: FormValues) =>
      staffService.create(canSignIn ? { ...profile, access: { role } } : profile),
    onSuccess: (staff) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      if (staff.tempPassword) setCreated(staff);
      else onClose();
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync(values);
    } catch (err) {
      const codes = getApiErrorCodes(err);
      if (['Staff.AlreadyExists', 'User.EmailAlreadyExists', 'Auth.EmailAlreadyExists', 'DuplicateEmail', 'DuplicateUserName'].some((c) => codes.has(c))) {
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
    <Drawer
      title={t('create.title')}
      onClose={onClose}
      footer={<DrawerActions formId={FORM_ID} cancelLabel={t('create.cancel')} onCancel={onClose}
        submitLabel={mutation.isPending ? t('create.saving') : t('create.submit')} pending={isSubmitting || mutation.isPending} />}
    >
      {/* Laid out like the rest of the app (user request 2026-11-13): named groups, no drop-downs */}
      <form id={FORM_ID} noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormSection title={t('create.sectionPerson')}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="staff-firstName" className={FIELD_LABEL}>
                {t('create.firstName')} <span className="text-red-500">*</span>
              </label>
              <input id="staff-firstName" type="text" className={FIELD_INPUT}
                {...register('firstName', { required: t('create.required') })} />
              {errors.firstName && <p className={FIELD_ERROR}>{errors.firstName.message}</p>}
            </div>
            <div>
              <label htmlFor="staff-lastName" className={FIELD_LABEL}>
                {t('create.lastName')} <span className="text-red-500">*</span>
              </label>
              <input id="staff-lastName" type="text" className={FIELD_INPUT}
                {...register('lastName', { required: t('create.required') })} />
              {errors.lastName && <p className={FIELD_ERROR}>{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <p className={FIELD_LABEL}>{t('create.staffType')}</p>
            <ChoiceChips
              label={t('create.staffType')}
              options={SELECTABLE_STAFF_TYPES.map((type) => ({ value: type, label: t(`staffType.${type}`) }))}
              value={staffType.value}
              onChange={staffType.onChange}
            />
          </div>
        </FormSection>

        <FormSection title={t('create.sectionContact')}>
          <div>
            <label htmlFor="staff-email" className={FIELD_LABEL}>
              {t('create.email')}{canSignIn && <span className="text-red-500"> *</span>}
            </label>
            <input id="staff-email" type="email" className={FIELD_INPUT} placeholder="staff@clinic.com"
              {...register('email', {
                validate: (v, values) => !values.canSignIn || !!v?.trim() || t('create.emailRequiredForAccess'),
              })} />
            {errors.email && <p className={FIELD_ERROR}>{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="staff-phone" className={FIELD_LABEL}>{t('create.phone')}</label>
            <input id="staff-phone" type="tel" className={FIELD_INPUT} {...register('phone')} />
          </div>
        </FormSection>

        <FormSection title={t('create.sectionWork')}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="staff-specialty" className={FIELD_LABEL}>{t('create.specialty')}</label>
              <input id="staff-specialty" type="text" className={FIELD_INPUT}
                placeholder={t('create.specialtyPlaceholder')} {...register('specialty')} />
            </div>
            <div>
              <label htmlFor="staff-hireDate" className={FIELD_LABEL}>{t('create.hireDate')}</label>
              <input id="staff-hireDate" type="date" className={FIELD_INPUT} {...register('hireDate')} />
            </div>
          </div>
          <div>
            <p className={FIELD_LABEL}>{t('create.color')}</p>
            <ColourSwatches label={t('create.color')} value={colour.value ?? '#3B82F6'} onChange={colour.onChange} />
          </div>
        </FormSection>

        {/* Sign-in access (people-merge plan D1): the profile email becomes the login */}
        <FormSection title={t('access.title')}>
          <Switch id="staff-canSignIn" label={t('create.canSignIn')} hint={t('create.canSignInHint')}
            checked={canSignIn} onChange={signIn.onChange} />
          {canSignIn && (
            <div>
              <p className={FIELD_LABEL}>{t('create.role')}</p>
              <ChoiceChips
                label={t('create.role')}
                options={TENANT_ROLES.map((r) => ({ value: r, label: tc(`role.${r}`) }))}
                value={role.value}
                onChange={role.onChange}
              />
            </div>
          )}
        </FormSection>
      </form>
    </Drawer>
  );
}
