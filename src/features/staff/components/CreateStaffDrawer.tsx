import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { Drawer } from '@/shared/components/Drawer';
import {
  staffService,
  STAFF_TYPE_LABELS,
  ALL_STAFF_TYPES,
  type CreateStaffRequest,
} from '../services/staffService';

interface Props {
  onClose: () => void;
}

export function CreateStaffDrawer({ onClose }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffRequest>({
    defaultValues: {
      staffType: 'Receptionist',
      colorHex: '#3B82F6',
    },
  });

  const mutation = useMutation({
    mutationFn: staffService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to create staff member. Please try again.'));
    },
  });

  const onSubmit = (data: CreateStaffRequest) => mutation.mutate(data);

  return (
    <Drawer title="Add Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        {/* First Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('firstName', { required: 'First name is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('lastName', { required: 'Last name is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
          )}
        </div>

        {/* Staff Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('staffType', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ALL_STAFF_TYPES.map((t) => (
              <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="staff@clinic.com"
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
            placeholder="e.g. Orthodontics"
          />
        </div>

        {/* Hire Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
          <input
            type="date"
            {...register('hireDate')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Calendar Color
          </label>
          <input
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Add Staff Member'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
