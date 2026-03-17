import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@/shared/components/Drawer';
import { appointmentService, type BookAppointmentRequest } from '../services/appointmentService';
import { patientService } from '@/features/patients/services/patientService';
import { toast } from 'sonner';
import { staffService, type StaffMemberResponse } from '@/features/staff/services/staffService';
import { getApiErrorMessage } from '@/shared/utils/apiError';

interface Props {
  onClose: () => void;
}

interface FormData {
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  startAt: string;
  durationMinutes: number;
  chiefComplaint: string;
  notes: string;
  isNewPatient: boolean;
}

export function BookAppointmentDrawer({ onClose }: Props) {
  const queryClient = useQueryClient();

  const { data: staffData } = useQuery({
    queryKey: ['staff', '', '', 1],
    queryFn: () => staffService.list({ pageSize: 100, isActive: true }),
  });

  const { data: typesData } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  });

  const { data: patientsData } = useQuery({
    queryKey: ['patients', '', '', 1],
    queryFn: () => patientService.list({ pageSize: 100 }),
  });

  const defaultStartAt = (() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    // datetime-local expects local "YYYY-MM-DDTHH:mm" — NOT toISOString() which is UTC
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      startAt: defaultStartAt,
      durationMinutes: 30,
      isNewPatient: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: BookAppointmentRequest) => appointmentService.book(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to book appointment. Please try again.'));
    },
  });

  const onSubmit = (data: FormData) => {
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + data.durationMinutes * 60_000);

    mutation.mutate({
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      chiefComplaint: data.chiefComplaint || undefined,
      notes: data.notes || undefined,
      isNewPatient: data.isNewPatient,
      source: 'Staff',
    });
  };

  const providers = (staffData?.items ?? []).filter(
    (s: StaffMemberResponse): s is StaffMemberResponse =>
      ['Dentist', 'Hygienist'].includes(s.staffType),
  );

  const patients = patientsData?.items ?? [];
  const apptTypes = typesData ?? [];

  return (
    <Drawer title="Book Appointment" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">

        {/* Patient */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Patient <span className="text-red-500">*</span>
          </label>
          <select
            {...register('patientId', { required: 'Patient is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          {errors.patientId && (
            <p className="mt-1 text-xs text-red-600">{errors.patientId.message}</p>
          )}
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider <span className="text-red-500">*</span>
          </label>
          <select
            {...register('providerId', { required: 'Provider is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select provider…</option>
            {providers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.staffType}
              </option>
            ))}
          </select>
          {errors.providerId && (
            <p className="mt-1 text-xs text-red-600">{errors.providerId.message}</p>
          )}
        </div>

        {/* Appointment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Appointment Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('appointmentTypeId', { required: 'Appointment type is required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select type…</option>
            {apptTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.defaultDurationMinutes} min)
              </option>
            ))}
          </select>
          {errors.appointmentTypeId && (
            <p className="mt-1 text-xs text-red-600">{errors.appointmentTypeId.message}</p>
          )}
        </div>

        {/* Date/Time + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              {...register('startAt', { required: 'Start time is required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.startAt && (
              <p className="mt-1 text-xs text-red-600">{errors.startAt.message}</p>
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
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
          <input
            type="text"
            {...register('chiefComplaint')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Tooth pain, routine checkup"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* New patient flag */}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register('isNewPatient')} className="rounded" />
          New patient appointment
        </label>

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
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Booking…' : 'Book Appointment'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
