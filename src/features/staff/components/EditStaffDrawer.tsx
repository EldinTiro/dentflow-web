import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@/shared/components/Drawer';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import {
  staffService,
  type StaffMemberResponse,
  type UpdateStaffRequest,
} from '../services/staffService';
import { peopleErrorMessage } from '../lib/peopleErrors';
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore';
import { can } from '@/shared/lib/permissions'

interface Props {
  staff: StaffMemberResponse;
  onClose: () => void;
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300';

export function EditStaffDrawer({ staff, onClose }: Props) {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const roles = useAuthStore(selectRoles);
  const canDelete = can(roles, 'people.manage');
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // DT-20 / D1: while the person can sign in, the profile email is their login email.
  const emailLocked = !!staff.access;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateStaffRequest>({
    defaultValues: {
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email ?? '',
      phone: staff.phone ?? '',
      specialty: staff.specialty ?? '',
      colorHex: staff.colorHex ?? '#3B82F6',
      biography: staff.biography ?? '',
      licenseNumber: staff.licenseNumber ?? '',
      licenseExpiry: staff.licenseExpiry ?? '',
      npiNumber: staff.npiNumber ?? '',
      address: staff.address ?? '',
      city: staff.city ?? '',
      postalCode: staff.postalCode ?? '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateStaffRequest) => staffService.update(staff.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, t('edit.failed')));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => staffService.delete(staff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    // A profile with appointments is deactivated, not deleted (Staff.HasHistory, D12).
    onError: (err: unknown) => {
      setConfirmDelete(false);
      toast.error(peopleErrorMessage(err, t, staff.fullName));
    },
  });

  const text = (id: keyof UpdateStaffRequest, label: string, type = 'text') => (
    <div>
      <label htmlFor={`staff-edit-${id}`} className={labelClass}>{label}</label>
      <input id={`staff-edit-${id}`} type={type} {...register(id)} className={inputClass} />
    </div>
  );

  return (
    <Drawer title={t('edit.title', { name: staff.fullName })} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-5 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="staff-edit-firstName" className={labelClass}>
              {t('create.firstName')} <span className="text-red-500">*</span>
            </label>
            <input id="staff-edit-firstName" type="text" className={inputClass}
              {...register('firstName', { required: t('create.required') })} />
            {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="staff-edit-lastName" className={labelClass}>
              {t('create.lastName')} <span className="text-red-500">*</span>
            </label>
            <input id="staff-edit-lastName" type="text" className={inputClass}
              {...register('lastName', { required: t('create.required') })} />
            {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="staff-edit-email" className={labelClass}>{t('create.email')}</label>
          <input id="staff-edit-email" type="email" readOnly={emailLocked} aria-describedby={emailLocked ? 'staff-edit-email-hint' : undefined}
            {...register('email')}
            className={`${inputClass} ${emailLocked ? 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 cursor-not-allowed' : ''}`} />
          {emailLocked && (
            <p id="staff-edit-email-hint" className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('edit.emailLocked')}</p>
          )}
        </div>

        {text('phone', t('create.phone'), 'tel')}
        {text('specialty', t('create.specialty'))}

        <div>
          <label htmlFor="staff-edit-colorHex" className={labelClass}>{t('create.color')}</label>
          <input id="staff-edit-colorHex" type="color" {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer dark:border-gray-600" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {text('licenseNumber', t('field.licenseNumber'))}
          {text('licenseExpiry', t('field.licenseExpiry'), 'date')}
        </div>
        {text('npiNumber', t('field.npiNumber'))}

        <div>
          <label htmlFor="staff-edit-biography" className={labelClass}>{t('section.biography')}</label>
          <textarea id="staff-edit-biography" rows={3} {...register('biography')} className={`${inputClass} resize-none`} />
        </div>

        {text('address', t('edit.address'))}
        <div className="grid grid-cols-2 gap-4">
          {text('city', t('edit.city'))}
          {text('postalCode', t('edit.postalCode'))}
        </div>

        <div className="flex items-center justify-between pt-2">
          {canDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-600 hover:text-red-800 font-medium">
              {t('edit.remove')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            >
              {tc('button.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? t('create.saving') : t('edit.save')}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={canDelete && confirmDelete}
        title={t('edit.removeTitle')}
        description={t('edit.removeBody', { name: staff.fullName })}
        confirmLabel={t('edit.removeConfirm')}
        cancelLabel={tc('button.cancel')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Drawer>
  );
}
