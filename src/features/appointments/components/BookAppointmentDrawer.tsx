import { useForm, Controller, useWatch } from 'react-hook-form';
import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@/shared/components/Drawer';
import { appointmentService, type BookAppointmentRequest } from '../services/appointmentService';
import { patientService, type PatientSearchResult } from '@/features/patients/services/patientService';
import { toast } from 'sonner';
import { staffService, type StaffMemberResponse } from '@/features/staff/services/staffService';
import { getApiErrorMessage } from '@/shared/utils/apiError';

interface Props {
  onClose: () => void;
  initialPatientId?: string;
  initialDate?: string;
  initialStartAt?: string;    // "YYYY-MM-DDTHH:mm" — takes priority over initialDate
  initialProviderId?: string;
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

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function BookAppointmentDrawer({ onClose, initialPatientId, initialDate, initialStartAt, initialProviderId }: Props) {
  const queryClient = useQueryClient();

  const defaultStartAt = (() => {
    if (initialStartAt) return initialStartAt;
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return initialDate ? `${initialDate}T09:00` : toLocalDatetimeValue(d);
  })();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [patientOpen, setPatientOpen] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
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
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      patientId: initialPatientId ?? '',
      providerId: initialProviderId ?? '',
      startAt: defaultStartAt,
      durationMinutes: 30,
      isNewPatient: false,
    },
  });

  const watchedProviderId = useWatch({ control, name: 'providerId' });
  const watchedStartAt = useWatch({ control, name: 'startAt' });
  const watchedDuration = useWatch({ control, name: 'durationMinutes' });

  const slotDate = watchedStartAt ? toDateOnly(new Date(watchedStartAt)) : '';

  const { data: staffData } = useQuery({
    queryKey: ['staff', { pageSize: 100, isActive: true }],
    queryFn: () => staffService.list({ pageSize: 100, isActive: true }),
  });

  const { data: typesData } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientService.search(patientSearch, 20),
    enabled: patientSearch.length >= 1,
    staleTime: 30_000,
  });

  const { data: slots, isFetching: isLoadingSlots } = useQuery({
    queryKey: ['slots', watchedProviderId, slotDate, watchedDuration],
    queryFn: () => appointmentService.getAvailableSlots(watchedProviderId, slotDate, watchedDuration ?? 30),
    enabled: !!watchedProviderId && !!slotDate && showSlotPicker,
    staleTime: 60_000,
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
    (s: StaffMemberResponse) => s.staffType === 'Dentist' || s.staffType === 'Hygienist',
  );
  const apptTypes = typesData ?? [];

  const displayResults = patientSearch.length >= 1 ? (searchResults ?? []) : [];

  return (
    <Drawer title="Book Appointment" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">

        {/* Patient — API autocomplete */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Patient <span className="text-red-500">*</span>
          </label>
          <Controller
            name="patientId"
            control={control}
            rules={{ required: 'Patient is required' }}
            render={({ field }) => (
              <div ref={patientRef} className="relative">
                <div
                  className={`flex items-center gap-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 ${
                    errors.patientId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                  } focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500`}
                >
                  <Search size={14} className="shrink-0 text-gray-400" />
                  {selectedPatient && !patientOpen ? (
                    <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                      {selectedPatient.fullName}
                      <span className="ml-1 text-gray-400 text-xs">{selectedPatient.patientNumber}</span>
                    </span>
                  ) : (
                    <input
                      autoComplete="off"
                      placeholder={selectedPatient ? selectedPatient.fullName : 'Ime, telefon ili broj kartona…'}
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setPatientOpen(true);
                      }}
                      onFocus={() => setPatientOpen(true)}
                      className="flex-1 outline-none bg-transparent placeholder-gray-400 dark:text-gray-100 min-w-0"
                    />
                  )}
                  {isSearching && <span className="text-xs text-gray-400">...</span>}
                  {field.value && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        field.onChange('');
                        setSelectedPatient(null);
                        setPatientSearch('');
                        setPatientOpen(false);
                      }}
                      className="shrink-0 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {patientOpen && patientSearch.length >= 1 && (
                  <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-sm">
                    {displayResults.length === 0 ? (
                      <li className="px-3 py-2 text-gray-400">
                        {isSearching ? 'Pretraživanje…' : 'Nema rezultata'}
                      </li>
                    ) : (
                      displayResults.map((p) => (
                        <li
                          key={p.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            field.onChange(p.id);
                            setSelectedPatient(p);
                            setPatientSearch('');
                            setPatientOpen(false);
                          }}
                          className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/40 ${
                            p.id === field.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="font-medium">{p.fullName}</span>
                          <span className="ml-2 text-xs text-gray-400">{p.patientNumber}</span>
                          {p.phoneMobile && <span className="ml-2 text-xs text-gray-400">{p.phoneMobile}</span>}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
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
            <option value="">Odaberi doktora…</option>
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
            Vrsta termina <span className="text-red-500">*</span>
          </label>
          <Controller
            name="appointmentTypeId"
            control={control}
            rules={{ required: 'Appointment type is required' }}
            render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  const type = apptTypes.find((t) => t.id === e.target.value);
                  if (type) setValue('durationMinutes', type.defaultDurationMinutes);
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Odaberi vrstu…</option>
                {apptTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.defaultDurationMinutes} min)
                  </option>
                ))}
              </select>
            )}
          />
          {errors.appointmentTypeId && (
            <p className="mt-1 text-xs text-red-600">{errors.appointmentTypeId.message}</p>
          )}
        </div>

        {/* Date / Slot Picker toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Datum i vrijeme <span className="text-red-500">*</span>
            </label>
            {watchedProviderId && (
              <button
                type="button"
                onClick={() => setShowSlotPicker((v) => !v)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Clock size={12} />
                {showSlotPicker ? 'Ručni unos' : 'Slobodni termini'}
              </button>
            )}
          </div>

          {!showSlotPicker ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="datetime-local"
                  {...register('startAt', { required: 'Start time is required' })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.startAt && <p className="mt-1 text-xs text-red-600">{errors.startAt.message}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Trajanje (min)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  {...register('durationMinutes', { required: true, min: 5, valueAsNumber: true })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div>
              {/* Date selector for slot picker */}
              <input
                type="date"
                value={slotDate}
                onChange={(e) => {
                  const currentTime = watchedStartAt ? watchedStartAt.split('T')[1] : '09:00';
                  setValue('startAt', `${e.target.value}T${currentTime}`);
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              />

              {isLoadingSlots ? (
                <p className="text-sm text-gray-400 py-4 text-center">Učitavanje slobodnih termina…</p>
              ) : !slots || slots.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Nema slobodnih termina za odabrani dan.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const slotStart = new Date(slot.startAt);
                    const localValue = toLocalDatetimeValue(slotStart);
                    const isSelected = watchedStartAt === localValue;
                    const timeStr = slotStart.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setValue('startAt', localValue)}
                        className={`py-2 px-1 rounded-lg text-sm font-medium border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                        }`}
                      >
                        {timeStr}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razlog dolaska</label>
          <input
            type="text"
            {...register('chiefComplaint')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="npr. Bol u zubu, redovni pregled"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Napomene</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* New patient flag */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" {...register('isNewPatient')} className="rounded" />
          Novi pacijent
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Odustani
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Rezervišem…' : 'Rezerviši termin'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
