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
      queryClient.invalidateQueries({ queryKey: ['staff-all-active'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to create staff member. Please try again.'));
    },
  });

  const onSubmit = (data: CreateStaffRequest) => mutation.mutate(data);

  return (
    <Drawer title="Add Staff Member" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        {/* First Name */}
        <div>
          <label htmlFor="staff-firstName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            First Name <span className="text-red-500">*</span>
          </label>
          <input id="staff-firstName"
            type="text"
            {...register('firstName', { required: 'First name is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="staff-lastName" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input id="staff-lastName"
            type="text"
            {...register('lastName', { required: 'Last name is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
          )}
        </div>

        {/* Staff Type */}
        <div>
          <label htmlFor="staff-staffType" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Staff Type <span className="text-red-500">*</span>
          </label>
          <select id="staff-staffType"
            {...register('staffType', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {ALL_STAFF_TYPES.map((t) => (
              <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
          <input id="staff-email"
            type="email"
            {...register('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="staff@clinic.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="staff-phone" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Phone</label>
          <input id="staff-phone"
            type="tel"
            {...register('phone')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Specialty */}
        <div>
          <label htmlFor="staff-specialty" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Specialty</label>
          <input id="staff-specialty"
            type="text"
            {...register('specialty')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="e.g. Orthodontics"
          />
        </div>

        {/* Hire Date */}
        <div>
          <label htmlFor="staff-hireDate" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Hire Date</label>
          <input id="staff-hireDate"
            type="date"
            {...register('hireDate')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Color */}
        <div>
          <label htmlFor="staff-colorHex" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Calendar Color
          </label>
          <input id="staff-colorHex"
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer dark:border-gray-600"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Add Staff Member'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
