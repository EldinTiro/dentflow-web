import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  CalendarDays,
  Clock,
  User,
  Stethoscope,
  MessageSquare,
  FileText,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  History,
  Pencil,
  Check,
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
import { billingService } from '@/features/billing/services/billingService'
import { CreateInvoiceDrawer } from '@/features/billing/components/CreateInvoiceDrawer'

interface Props {
  appointment: AppointmentResponse
  onClose: () => void
  onReschedule: (a: AppointmentResponse) => void
  onRebook?: (a: AppointmentResponse) => void
  canManage: boolean
  isAdmin?: boolean
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

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  PartiallyPaid: 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Void: 'bg-red-100 text-red-500',
}

export function AppointmentDetailPanel({
  appointment: a,
  onClose,
  onReschedule,
  onRebook,
  canManage,
  isAdmin = false,
}: Props) {
  const queryClient = useQueryClient()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showBilling, setShowBilling] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(a.notes ?? '')
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)

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

  const { data: invoices } = useQuery({
    queryKey: ['patient-invoices', a.patientId],
    queryFn: () => billingService.listByPatient(a.patientId, { pageSize: 5 }),
    enabled: showBilling,
  })

  const { data: history } = useQuery({
    queryKey: ['appointment-history', a.id],
    queryFn: () => appointmentService.getHistory(a.id),
    enabled: showHistory,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
    queryClient.invalidateQueries({ queryKey: ['appointments-today'] })
    queryClient.invalidateQueries({ queryKey: ['appointments-week'] })
  }

  const statusMutation = useMutation({
    mutationFn: (next: AppointmentStatus) => appointmentService.updateStatus(a.id, next),
    onSuccess: () => { invalidate(); onClose() },
  })

  const cancelMutation = useMutation({
    mutationFn: () => appointmentService.cancel(a.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  const notesMutation = useMutation({
    mutationFn: (notes: string | null) => appointmentService.updateNotes(a.id, notes),
    onSuccess: () => {
      invalidate()
      setEditingNotes(false)
    },
  })

  const apptType = types?.find((t) => t.id === a.appointmentTypeId)
  const isTerminal = ['Completed', 'Cancelled', 'NoShow'].includes(a.status)

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

  const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-[420px] bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Appointment Detail</h2>
            <span
              className={`dot-badge mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
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

          {/* Notes with inline editing */}
          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <FileText size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">Notes</p>
                {canManage && !editingNotes && (
                  <button
                    onClick={() => { setNotesDraft(a.notes ?? ''); setEditingNotes(true) }}
                    className="text-gray-400 hover:text-indigo-600 p-0.5 rounded"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="mt-1 space-y-1">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => notesMutation.mutate(notesDraft || null)}
                      disabled={notesMutation.isPending}
                      className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Check size={11} /> Save
                    </button>
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-800 mt-0.5">
                  {a.notes ? (
                    <span className="whitespace-pre-wrap">{a.notes}</span>
                  ) : (
                    <span className="text-gray-300 italic text-xs">No notes</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {a.cancellationReason && (
            <DetailRow
              icon={AlertCircle}
              label="Cancellation Reason"
              value={a.cancellationReason}
            />
          )}
          {a.isNewPatient && (
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                New Patient
              </span>
            </div>
          )}

          {/* Billing section */}
          <div className="pt-2">
            <button
              onClick={() => setShowBilling((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
            >
              <span className="flex items-center gap-2">
                <Receipt size={14} className="text-gray-400" />
                Patient Invoices
              </span>
              {showBilling ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showBilling && (
              <div className="mt-1 space-y-1.5">
                {!invoices ? (
                  <p className="text-xs text-gray-400 italic">Loading…</p>
                ) : invoices.items.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No invoices found for this patient.</p>
                ) : (
                  invoices.items.map((inv) => (
                    <a
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-800">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400">{formatShortDate(inv.issuedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {inv.status}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          ${inv.balanceDue.toFixed(2)} due
                        </span>
                      </div>
                    </a>
                  ))
                )}
                <a
                  href={`/patients/${a.patientId}?tab=billing`}
                  className="block text-xs text-indigo-600 hover:underline pt-1"
                >
                  View all invoices →
                </a>
              </div>
            )}
          </div>

          {/* History section */}
          <div className="pt-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
            >
              <span className="flex items-center gap-2">
                <History size={14} className="text-gray-400" />
                Status History
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div className="mt-1 space-y-1.5">
                {!history ? (
                  <p className="text-xs text-gray-400 italic">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No status changes recorded.</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                      <div className="flex-1">
                        <span className="font-medium">{h.fromStatus ?? '—'}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="font-medium">{h.toStatus}</span>
                        {h.isOverride && (
                          <span className="ml-1.5 text-orange-600 font-medium">(override)</span>
                        )}
                        {h.reason && <p className="text-gray-400 mt-0.5">{h.reason}</p>}
                        <p className="text-gray-300 mt-0.5">{formatShortDate(h.changedAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions footer */}
        {canManage && (
          <div className="border-t border-gray-200 px-5 py-4 space-y-2">
            {/* Primary lifecycle action */}
            {a.status === 'Scheduled' && (
              <button
                onClick={() => statusMutation.mutate('CheckedIn')}
                disabled={statusMutation.isPending}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? 'Updating…' : 'Check In'}
              </button>
            )}
            {a.status === 'CheckedIn' && (
              <button
                onClick={() => statusMutation.mutate('InProgress')}
                disabled={statusMutation.isPending}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? 'Updating…' : 'Start Treatment'}
              </button>
            )}
            {a.status === 'InProgress' && (
              <button
                onClick={() => statusMutation.mutate('Completed')}
                disabled={statusMutation.isPending}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? 'Updating…' : 'Complete Appointment'}
              </button>
            )}

            {/* Secondary row */}
            <div className="flex gap-2">
              {/* No-show (Scheduled only) */}
              {a.status === 'Scheduled' && (
                <button
                  onClick={() => statusMutation.mutate('NoShow')}
                  disabled={statusMutation.isPending}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  No Show
                </button>
              )}

              {/* Reschedule (non-terminal only) */}
              {!isTerminal && (
                <button
                  onClick={() => onReschedule(a)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Reschedule
                </button>
              )}

              {/* Cancel (non-terminal only) */}
              {!isTerminal && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Cancel
                </button>
              )}

              {/* Rebook (terminal states) */}
              {isTerminal && onRebook && (
                <button
                  onClick={() => onRebook(a)}
                  className="flex-1 border border-indigo-200 text-indigo-600 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                >
                  Rebook
                </button>
              )}
            </div>

            {/* Bill patient (completed only) */}
            {a.status === 'Completed' && (
              <button
                onClick={() => setShowCreateInvoice(true)}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Bill Patient
              </button>
            )}

            {/* Admin override (admin only, for non-terminal stuck states) */}
            {isAdmin && !isTerminal && (
              <p className="text-xs text-center text-gray-400">
                Admin: use the API to override status if needed.
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel appointment"
        description={<>Are you sure you want to cancel this appointment?</>}
        confirmLabel="Cancel Appointment"
        isPending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>

    {showCreateInvoice && (
      <CreateInvoiceDrawer
        patientId={a.patientId}
        appointmentTypeId={a.appointmentTypeId}
        onClose={() => setShowCreateInvoice(false)}
      />
    )}
  </>
  )
}

