import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentService, type AppointmentResponse } from '../services/appointmentService';
import { getApiErrorMessage } from '@/shared/utils/apiError';

interface Props {
  appointment: AppointmentResponse;
  onClose: () => void;
}

interface FormData {
  newStartAt: string;
  durationMinutes: number;
}

export function RescheduleModal({ appointment, onClose }: Props) {
  const queryClient = useQueryClient();

  const defaultStart = (() => {
    const d = new Date(appointment.startAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      newStartAt: defaultStart,
      durationMinutes: appointment.durationMinutes,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const start = new Date(data.newStartAt);
      const end = new Date(start.getTime() + data.durationMinutes * 60_000);
      return appointmentService.reschedule(appointment.id, {
        newStartAt: start.toISOString(),
        newEndAt: end.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to reschedule. Please try again.'));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Reschedule Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Start <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              {...register('newStartAt', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.newStartAt && (
              <p className="mt-1 text-xs text-red-600">{errors.newStartAt.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              {...register('durationMinutes', { required: true, min: 5, valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
