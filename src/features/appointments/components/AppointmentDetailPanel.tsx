import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Clock,
  User,
  Stethoscope,
  MessageSquare,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react'
import {
  appointmentService,
  APPOINTMENT_STATUS_LABELS,
  STATUS_COLORS,
  type AppointmentResponse,
  type AppointmentStatus,
} from '../services/appointmentService'
import { patientService } from '@/features/patients/services/patientService'
import { staffService } from '@/features/staff/services/staffService'

interface Props {
  appointment: AppointmentResponse
  onClose: () => void
  onReschedule: (a: AppointmentResponse) => void
  canManage: boolean
}

const NEXT_STATUS: Partial<Record<AppointmentStatus, { label: string; next: AppointmentStatus }>> = {
  Scheduled: { label: 'Confirm', next: 'Confirmed' },
  Confirmed: { label: 'Check In', next: 'CheckedIn' },
  CheckedIn: { label: 'Seat Patient', next: 'InChair' },
  InChair: { label: 'Complete', next: 'Completed' },
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <Icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <div className="text-sm text-gray-800 mt-0.5 break-words">{value}</div>
      </div>
    </div>
  )
}

export function AppointmentDetailPanel({ appointment: a, onClose, onReschedule, canManage }: Props) {
  const queryClient = useQueryClient()

  const { data: patient } = useQuery({
    queryKey: ['patient', a.patientId],
    queryFn: () => patientService.getById(a.patientId),
  })

  const { data: provider } = useQuery({
    queryKey: ['staff-member', a.providerId],
    queryFn: () => staffService.getById(a.providerId),
  })

  const { data: types } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  })

  const apptType = types?.find((t) => t.id === a.appointmentTypeId)

  const statusMutation = useMutation({
    mutationFn: (next: AppointmentStatus) => appointmentService.updateStatus(a.id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['appointments-today'] })
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] })
      onClose()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => appointmentService.cancel(a.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['appointments-today'] })
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] })
      onClose()
    },
  })

  const nextAction = NEXT_STATUS[a.status as AppointmentStatus]
  const canTransition =
    canManage &&
    a.status !== 'Cancelled' &&
    a.status !== 'Completed' &&
    a.status !== 'NoShow'

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-[400px] bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Appointment Detail</h2>
            <span
              className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[a.status as AppointmentStatus] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DetailRow
            icon={User}
            label="Patient"
            value={
              patient ? (
                <a
                  href={`/patients/${a.patientId}`}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  {patient.fullName}
                </a>
              ) : (
                <span className="text-gray-300 italic">Loading…</span>
              )
            }
          />
          <DetailRow
            icon={Stethoscope}
            label="Provider"
            value={provider?.fullName ?? <span className="text-gray-300 italic">Loading…</span>}
          />
          <DetailRow
            icon={CalendarDays}
            label="Date & Time"
            value={`${formatDT(a.startAt)} → ${new Date(a.endAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}`}
          />
          <DetailRow
            icon={Clock}
            label="Duration"
            value={`${a.durationMinutes} minutes`}
          />
          {apptType && (
            <DetailRow
              icon={FileText}
              label="Appointment Type"
              value={apptType.name}
            />
          )}
          {a.chiefComplaint && (
            <DetailRow
              icon={MessageSquare}
              label="Chief Complaint"
              value={a.chiefComplaint}
            />
          )}
          {a.notes && (
            <DetailRow
              icon={FileText}
              label="Notes"
              value={<span className="whitespace-pre-wrap">{a.notes}</span>}
            />
          )}
          {a.cancellationReason && (
            <DetailRow
              icon={AlertCircle}
              label="Cancellation Reason"
              value={a.cancellationReason}
            />
          )}
          {a.isNewPatient && (
            <div className="mt-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                New Patient
              </span>
            </div>
          )}
        </div>

        {/* Actions footer */}
        {canManage && canTransition && (
          <div className="border-t border-gray-200 px-5 py-4 space-y-2">
            {nextAction && (
              <button
                onClick={() => statusMutation.mutate(nextAction.next)}
                disabled={statusMutation.isPending}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? 'Updating…' : nextAction.label}
              </button>
            )}
            <div className="flex gap-2">
              {a.status !== 'Rescheduled' && (
                <button
                  onClick={() => onReschedule(a)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Reschedule
                </button>
              )}
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
