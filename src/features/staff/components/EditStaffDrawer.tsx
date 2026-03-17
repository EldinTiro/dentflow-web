import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@/shared/components/Drawer';
import {
  staffService,
  type StaffMemberResponse,
  type UpdateStaffRequest,
} from '../services/staffService';
import { useAuthStore } from '@/features/auth/store/authStore';

interface Props {
  staff: StaffMemberResponse;
  onClose: () => void;
}

export function EditStaffDrawer({ staff, onClose }: Props) {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canDelete = roles.includes('ClinicOwner') || roles.includes('SuperAdmin');
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('firstName', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('lastName', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            {...register('phone')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Specialty */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
          <input
            type="text"
            {...register('specialty')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calendar Color</label>
          <input
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer"
          />
        </div>

        {/* License + NPI */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License #</label>
            <input
              type="text"
              {...register('licenseNumber')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
            <input
              type="date"
              {...register('licenseExpiry')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NPI Number</label>
          <input
            type="text"
            {...register('npiNumber')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Biography */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Biography</label>
          <textarea
            {...register('biography')}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Delete confirmation inline */}
        {canDelete && confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-red-800">
              Are you sure you want to remove {staff.fullName}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Removing…' : 'Yes, remove'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {canDelete && !confirmDelete ? (
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
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
