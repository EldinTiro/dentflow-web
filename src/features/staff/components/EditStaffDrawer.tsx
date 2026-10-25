import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore';
import { can } from '@/shared/lib/permissions'

interface Props {
  staff: StaffMemberResponse;
  onClose: () => void;
}

export function EditStaffDrawer({ staff, onClose }: Props) {
  const roles = useAuthStore(selectRoles);
  const canDelete = can(roles, 'people.manage');
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      toast.error(getApiErrorMessage(err, 'Failed to update staff member. Please try again.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => staffService.delete(staff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  const onSubmit = (data: UpdateStaffRequest) => updateMutation.mutate(data);

  return (
    <Drawer title={`Edit — ${staff.fullName}`} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="staff-edit-firstName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              First Name <span className="text-red-500">*</span>
            </label>
            <input id="staff-edit-firstName"
              type="text"
              {...register('firstName', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="staff-edit-lastName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input id="staff-edit-lastName"
              type="text"
              {...register('lastName', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="staff-edit-email" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
          <input id="staff-edit-email"
            type="email"
            {...register('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="staff-edit-phone" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Phone</label>
          <input id="staff-edit-phone"
            type="tel"
            {...register('phone')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Specialty */}
        <div>
          <label htmlFor="staff-edit-specialty" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Specialty</label>
          <input id="staff-edit-specialty"
            type="text"
            {...register('specialty')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Color */}
        <div>
          <label htmlFor="staff-edit-colorHex" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Calendar Color</label>
          <input id="staff-edit-colorHex"
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer dark:border-gray-600"
          />
        </div>

        {/* License + NPI */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="staff-edit-licenseNumber" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">License #</label>
            <input id="staff-edit-licenseNumber"
              type="text"
              {...register('licenseNumber')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label htmlFor="staff-edit-licenseExpiry" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">License Expiry</label>
            <input id="staff-edit-licenseExpiry"
              type="date"
              {...register('licenseExpiry')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="staff-edit-npiNumber" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">NPI Number</label>
          <input id="staff-edit-npiNumber"
            type="text"
            {...register('npiNumber')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Biography */}
        <div>
          <label htmlFor="staff-edit-biography" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Biography</label>
          <textarea id="staff-edit-biography"
            {...register('biography')}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="staff-edit-address" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Address</label>
          <input id="staff-edit-address"
            type="text"
            {...register('address')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="staff-edit-city" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">City</label>
            <input id="staff-edit-city"
              type="text"
              {...register('city')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label htmlFor="staff-edit-postalCode" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Postal Code</label>
            <input id="staff-edit-postalCode"
              type="text"
              {...register('postalCode')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Remove staff member
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={canDelete && confirmDelete}
        title="Remove staff member?"
        description={<>Remove <strong>{staff.fullName}</strong>? This action cannot be undone.</>}
        confirmLabel="Remove"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Drawer>
  );
}
