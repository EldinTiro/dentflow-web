import { useForm, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useId } from 'react';
import { Search, X, Clock, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@/shared/components/Drawer';
import { appointmentService, type BookAppointmentRequest } from '../services/appointmentService';
import { patientService, type PatientSearchResult } from '@/features/patients/services/patientService';
import { toast } from 'sonner';
import { staffService, type StaffMemberResponse } from '@/features/staff/services/staffService';
import { getApiErrorMessage } from '@/shared/utils/apiError';
import { useUserPreferences } from '@/features/auth/hooks/useUserPreferences';
import { AllergyAlert } from '@/features/patients/components/AllergyAlert';
import { nextBookableStart } from '@/shared/lib/clinicSchedule';
import { tenantService } from '@/features/admin/services/tenantService';

interface Props {
  onClose: () => void;
  initialPatientId?: string;
  /** Pre-selects and displays this patient (booking from a patient chart). */
  initialPatient?: PatientSearchResult;
  initialDate?: string;
  initialStartAt?: string;
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
  newFirstName: string;
  newLastName: string;
  newPhone: string;
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function BookAppointmentDrawer({ onClose, initialPatientId, initialPatient, initialDate, initialStartAt, initialProviderId }: Props) {
  const { t } = useTranslation('appointments');
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const queryClient = useQueryClient();
  const { data: preferences } = useUserPreferences();
  const use24h = preferences?.timeFormat !== '12h';

  // Usually already cached by the dashboard / settings; the default schedule covers a cold cache.
  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: tenantService.getSettings,
    staleTime: 10 * 60 * 1000,
  });

  const defaultStartAt = (() => {
    if (initialStartAt) return initialStartAt;
    if (initialDate) return `${initialDate}T09:00`;
    // Next quarter hour within opening hours — not "now" at 01:15 (QA-018).
    return nextBookableStart(new Date(), clinicSettings?.weeklyScheduleJson);
  })();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(initialPatient ?? null);
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
      patientId: initialPatient?.id ?? initialPatientId ?? '',
      providerId: initialProviderId ?? '',
      startAt: defaultStartAt,
      durationMinutes: 30,
      isNewPatient: false,
      newFirstName: '',
      newLastName: '',
      newPhone: '',
    },
  });

  const isNewPatient = useWatch({ control, name: 'isNewPatient' });
  const watchedPatientId = useWatch({ control, name: 'patientId' });
  const watchedProviderId = useWatch({ control, name: 'providerId' });
  const watchedStartAt = useWatch({ control, name: 'startAt' });
  const watchedDuration = useWatch({ control, name: 'durationMinutes' });

  const slotDate = watchedStartAt ? toDateOnly(new Date(watchedStartAt)) : '';

  const { data: staffData, isLoading: isStaffLoading } = useQuery({
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
    enabled: patientSearch.length >= 1 && !isNewPatient,
    staleTime: 30_000,
  });

  const { data: slots, isFetching: isLoadingSlots } = useQuery({
    queryKey: ['slots', watchedProviderId, slotDate, watchedDuration],
    queryFn: () => appointmentService.getAvailableSlots(watchedProviderId, slotDate, watchedDuration ?? 30),
    enabled: !!watchedProviderId && !!slotDate && showSlotPicker,
    staleTime: 60_000,
  });

  const createPatientMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; phoneMobile?: string }) =>
      patientService.create({ firstName: data.firstName, lastName: data.lastName, phoneMobile: data.phoneMobile || null, smsOptIn: false, emailOptIn: false }),
  });

  const bookMutation = useMutation({
    mutationFn: (data: BookAppointmentRequest) => appointmentService.book(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-all'] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, t('booking.bookFailed')));
    },
  });

  const onSubmit = async (data: FormData) => {
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + data.durationMinutes * 60_000);

    let patientId = data.patientId;

    if (isNewPatient) {
      try {
        const newPatient = await createPatientMutation.mutateAsync({
          firstName: data.newFirstName,
          lastName: data.newLastName,
          phoneMobile: data.newPhone || undefined,
        });
        patientId = newPatient.id;
        toast.success(t('booking.patientCreated', { name: newPatient.fullName }));
      } catch (err) {
        toast.error(getApiErrorMessage(err, t('booking.patientCreateFailed')));
        return;
      }
    }

    bookMutation.mutate({
      patientId,
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
  const isPending = createPatientMutation.isPending || bookMutation.isPending;

  return (
    <Drawer title={t('booking.title')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">

        {/* Patient field */}
        <div>
          <label htmlFor={fid('patient')} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('booking.patient')} <span className="text-red-500">*</span>
          </label>

          {isNewPatient ? (
            /* ── Inline new-patient mini-form ── */
            <div className="rounded-lg border border-primary-200 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-3 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400">
                  <UserPlus size={13} /> {t('booking.newPatient')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setValue('isNewPatient', false);
                    setValue('newFirstName', '');
                    setValue('newLastName', '');
                    setValue('newPhone', '');
                    setPatientSearch('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 underline dark:text-gray-400"
                >
                  {t('booking.searchExisting')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={fid('newFirstName')} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('booking.firstName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={fid('newFirstName')}
                    {...register('newFirstName', { required: isNewPatient ? t('booking.required') : false })}
                    placeholder={t('booking.firstNamePlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.newFirstName && <p className="mt-1 text-xs text-red-600">{errors.newFirstName.message}</p>}
                </div>
                <div>
                  <label htmlFor={fid('newLastName')} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('booking.lastName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={fid('newLastName')}
                    {...register('newLastName', { required: isNewPatient ? t('booking.required') : false })}
                    placeholder={t('booking.lastNamePlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.newLastName && <p className="mt-1 text-xs text-red-600">{errors.newLastName.message}</p>}
                </div>
              </div>
              <div>
                <label htmlFor={fid('newPhone')} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('booking.phone')}</label>
                <input
                  id={fid('newPhone')}
                  {...register('newPhone')}
                  placeholder="+387 61 123 456"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('booking.chartOpenedOnBooking')}
              </p>
            </div>
          ) : (
            /* ── Existing patient search ── */
            <Controller
              name="patientId"
              control={control}
              rules={{ required: !isNewPatient ? t('booking.patientRequired') : false }}
              render={({ field }) => (
                <div ref={patientRef} className="relative">
                  <div
                    className={`flex items-center gap-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 ${
                      errors.patientId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                    } focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500`}
                  >
                    <Search size={14} className="shrink-0 text-gray-500 dark:text-gray-400" />
                    {selectedPatient && !patientOpen ? (
                      <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                        {selectedPatient.fullName}
                        <span className="ml-1 text-gray-500 text-xs dark:text-gray-400">{selectedPatient.patientNumber}</span>
                      </span>
                    ) : (
                      <input
                        id={fid('patient')}
                        autoComplete="off"
                        placeholder={t('booking.patientSearchPlaceholder')}
                        value={patientSearch}
                        onChange={(e) => { setPatientSearch(e.target.value); setPatientOpen(true); }}
                        onFocus={() => setPatientOpen(true)}
                        className="flex-1 outline-none bg-transparent placeholder-gray-400 dark:text-gray-100 min-w-0"
                      />
                    )}
                    {isSearching && <span className="text-xs text-gray-500 dark:text-gray-400">...</span>}
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
                        className="shrink-0 text-gray-500 hover:text-gray-600 dark:text-gray-400"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {patientOpen && patientSearch.length >= 1 && (
                    <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-sm">
                      {isSearching ? (
                        <li className="px-3 py-2 text-gray-500 dark:text-gray-400">{t('booking.searching')}</li>
                      ) : displayResults.length > 0 ? (
                        <>
                          {displayResults.map((p) => (
                            <li
                              key={p.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                field.onChange(p.id);
                                setSelectedPatient(p);
                                setPatientSearch('');
                                setPatientOpen(false);
                              }}
                              className={`px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/40 ${
                                p.id === field.value ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-400/10 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <span className="font-medium">{p.fullName}</span>
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{p.patientNumber}</span>
                              {p.phoneMobile && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{p.phoneMobile}</span>}
                            </li>
                          ))}
                        </>
                      ) : (
                        /* No results — offer to create */
                        <li
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const parts = patientSearch.trim().split(/\s+/);
                            const firstName = parts[0] ?? '';
                            const lastName = parts.slice(1).join(' ');
                            setValue('isNewPatient', true);
                            setValue('newFirstName', firstName);
                            setValue('newLastName', lastName);
                            setPatientOpen(false);
                          }}
                          className="px-3 py-2.5 cursor-pointer flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 font-medium"
                        >
                          <UserPlus size={14} className="shrink-0" />
                          {t('booking.createChartFor', { query: patientSearch })}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            />
          )}
          {errors.patientId && !isNewPatient && (
            <p className="mt-1 text-xs text-red-600">{errors.patientId.message}</p>
          )}
          {!isNewPatient && watchedPatientId && <AllergyAlert patientId={watchedPatientId} className="mt-2" />}
        </div>

        {/* Provider */}
        <div>
          <label htmlFor={fid('provider')} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('booking.provider')} <span className="text-red-500">*</span>
          </label>
          <select
            id={fid('provider')}
            {...register('providerId', { required: t('booking.providerRequired') })}
            disabled={isStaffLoading}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-wait"
          >
            <option value="">{isStaffLoading ? t('booking.loading') : t('booking.selectProvider')}</option>
            {providers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.staffType}
              </option>
            ))}
          </select>
          {errors.providerId && <p className="mt-1 text-xs text-red-600">{errors.providerId.message}</p>}
        </div>

        {/* Appointment Type */}
        <div>
          <label htmlFor={fid('type')} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('booking.appointmentType')} <span className="text-red-500">*</span>
          </label>
          <Controller
            name="appointmentTypeId"
            control={control}
            rules={{ required: t('booking.typeRequired') }}
            render={({ field }) => (
              <select
                id={fid('type')}
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  const type = apptTypes.find((t) => t.id === e.target.value);
                  if (type) setValue('durationMinutes', type.defaultDurationMinutes);
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('booking.selectType')}</option>
                {apptTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.defaultDurationMinutes} min)
                  </option>
                ))}
              </select>
            )}
          />
          {errors.appointmentTypeId && <p className="mt-1 text-xs text-red-600">{errors.appointmentTypeId.message}</p>}
        </div>

        {/* Date / Slot Picker */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={fid('date')} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('booking.dateTime')} <span className="text-red-500">*</span>
            </label>
            {watchedProviderId && (
              <button
                type="button"
                onClick={() => setShowSlotPicker((v) => !v)}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 dark:text-primary-400"
              >
                <Clock size={12} />
                {showSlotPicker ? t('booking.manualEntry') : t('booking.freeSlots')}
              </button>
            )}
          </div>

          {!showSlotPicker ? (
            <div className="flex flex-wrap gap-4 items-end">
              {/* Wraps instead of squeezing the date to "/2026" in the 460px drawer (QA-023). */}
              <div className="flex-1 min-w-[16rem]">
                <input type="hidden" {...register('startAt', { required: t('booking.startRequired') })} />
                <div className="flex gap-1.5">
                  <input
                    id={fid('date')}
                    type="date"
                    value={slotDate}
                    onChange={(e) => {
                      const time = watchedStartAt?.split('T')[1] ?? '09:00';
                      setValue('startAt', `${e.target.value}T${time}`, { shouldValidate: true });
                    }}
                    className="flex-1 min-w-[9.5rem] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shrink-0 overflow-hidden">
                    <select
                      aria-label={t('booking.hour')}
                      value={watchedStartAt?.split('T')[1]?.slice(0, 2) ?? '09'}
                      onChange={(e) => {
                        const min = watchedStartAt?.split('T')[1]?.slice(3, 5) ?? '00';
                        setValue('startAt', `${slotDate}T${e.target.value}:${min}`, { shouldValidate: true });
                      }}
                      className="text-sm bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none px-1 py-2 border-0 w-14 text-center cursor-pointer"
                    >
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-gray-500 dark:text-gray-400 select-none font-semibold text-xs">:</span>
                    <select
                      aria-label={t('booking.minute')}
                      value={watchedStartAt?.split('T')[1]?.slice(3, 5) ?? '00'}
                      onChange={(e) => {
                        const hour = watchedStartAt?.split('T')[1]?.slice(0, 2) ?? '09';
                        setValue('startAt', `${slotDate}T${hour}:${e.target.value}`, { shouldValidate: true });
                      }}
                      className="text-sm bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none px-1 py-2 border-0 w-14 text-center cursor-pointer"
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {errors.startAt && <p className="mt-1 text-xs text-red-600">{errors.startAt.message}</p>}
              </div>
              <div>
                <label htmlFor={fid('duration')} className="block text-xs text-gray-500 mb-1 dark:text-gray-400">{t('booking.durationMin')}</label>
                <input
                  id={fid('duration')}
                  type="number"
                  min={5}
                  step={5}
                  {...register('durationMinutes', { required: true, min: 5, valueAsNumber: true })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <input
                id={fid('date')}
                type="date"
                value={slotDate}
                onChange={(e) => {
                  const currentTime = watchedStartAt ? watchedStartAt.split('T')[1] : '09:00';
                  setValue('startAt', `${e.target.value}T${currentTime}`);
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
              />
              {isLoadingSlots ? (
                <p className="text-sm text-gray-500 py-4 text-center dark:text-gray-400">{t('booking.loadingSlots')}</p>
              ) : !slots || slots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center dark:text-gray-400">{t('booking.noSlots')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const slotStart = new Date(slot.startAt);
                    const localValue = toLocalDatetimeValue(slotStart);
                    const isSelected = watchedStartAt === localValue;
                    const timeStr = slotStart.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', hour12: !use24h });
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setValue('startAt', localValue)}
                        className={`py-2 px-1 rounded-lg text-sm font-medium border transition-colors ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 hover:text-primary-600'
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
          <label htmlFor={fid('reason')} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('booking.reason')}</label>
          <input
            id={fid('reason')}
            type="text"
            {...register('chiefComplaint')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder={t('booking.reasonPlaceholder')}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor={fid('notes')} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('booking.notes')}</label>
          <textarea
            id={fid('notes')}
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {t('booking.cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {isPending
              ? createPatientMutation.isPending ? t('booking.creatingPatient') : t('booking.booking')
              : t('booking.book')}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
