import { useForm, Controller } from 'react-hook-form';
import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const defaultStartAt = (() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    // datetime-local expects local "YYYY-MM-DDTHH:mm" — NOT toISOString() which is UTC
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setPatientOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const {
    register,
    handleSubmit,
    control,
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
      s.staffType === 'Dentist',
  );

  const patients = patientsData?.items ?? [];
  const apptTypes = typesData ?? [];

  return (
    <Drawer title="Book Appointment" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">

        {/* Patient — searchable combobox */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Patient <span className="text-red-500">*</span>
          </label>
          <Controller
            name="patientId"
            control={control}
            rules={{ required: 'Patient is required' }}
            render={({ field }) => {
              const selectedPatient = patients.find((p) => p.id === field.value);
              const filtered = patients.filter((p) =>
                `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
              );
              return (
                <div ref={patientRef} className="relative">
                  {/* Trigger row */}
                  <div
                    className={`flex items-center gap-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 cursor-text ${
                      errors.patientId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                    } focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500`}
                    onClick={() => setPatientOpen(true)}
                  >
                    <Search size={14} className="shrink-0 text-gray-400" />
                    {selectedPatient && !patientOpen ? (
                      <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </span>
                    ) : (
                      <input
                        autoComplete="off"
                        placeholder={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Search patient…'}
                        value={patientSearch}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setPatientOpen(true);
                        }}
                        onFocus={() => setPatientOpen(true)}
                        className="flex-1 outline-none bg-transparent placeholder-gray-400 dark:text-gray-100 min-w-0"
                      />
                    )}
                    {field.value && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          field.onChange('');
                          setPatientSearch('');
                          setPatientOpen(false);
                        }}
                        className="shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown */}
                  {patientOpen && (
                    <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-sm">
                      {filtered.length === 0 ? (
                        <li className="px-3 py-2 text-gray-400">No patients found</li>
                      ) : (
                        filtered.map((p) => (
                          <li
                            key={p.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              field.onChange(p.id);
                              setPatientSearch('');
                              setPatientOpen(false);
                            }}
                            className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 ${
                              p.id === field.value ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {p.firstName} {p.lastName}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            }}
          />
          {errors.patientId && (
            <p className="mt-1 text-xs text-red-600">{errors.patientId.message}</p>
          )}
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Provider <span className="text-red-500">*</span>
          </label>
          <select
            {...register('providerId', { required: 'Provider is required' })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Appointment Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('appointmentTypeId', { required: 'Appointment type is required' })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              {...register('startAt', { required: 'Start time is required' })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.startAt && (
              <p className="mt-1 text-xs text-red-600">{errors.startAt.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              {...register('durationMinutes', { required: true, min: 5, valueAsNumber: true })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chief Complaint</label>
          <input
            type="text"
            {...register('chiefComplaint')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Tooth pain, routine checkup"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* New patient flag */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" {...register('isNewPatient')} className="rounded" />
          New patient appointment
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
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
