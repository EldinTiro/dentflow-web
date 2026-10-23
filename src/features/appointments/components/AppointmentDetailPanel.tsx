import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useAuthStore } from '@/features/auth/store/authStore'
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
  ShieldAlert,
} from 'lucide-react'
import {
  appointmentService,
  STATUS_COLORS,
  type AppointmentResponse,
  type AppointmentStatus,
} from '../services/appointmentService'
import { invalidateAppointmentQueries } from '../services/appointmentQueries'
import { patientService } from '@/features/patients/services/patientService'
import { staffService } from '@/features/staff/services/staffService'
import { billingService, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '@/features/billing/services/billingService'
import { CreateInvoiceDrawer } from '@/features/billing/components/CreateInvoiceDrawer'
import { AllergyAlert } from '@/features/patients/components/AllergyAlert'
import { useEscapeKey } from '@/shared/lib/useEscapeKey'

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
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <Icon size={15} className="text-gray-500 mt-0.5 shrink-0 dark:text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium dark:text-gray-400">{label}</p>
        <div className="text-sm text-gray-800 mt-0.5 break-words dark:text-gray-100">{value}</div>
      </div>
    </div>
  )
}


/** 'CheckedIn' → common:appointmentStatus.checkedIn */
const statusKey = (status: string) => `appointmentStatus.${status.charAt(0).toLowerCase()}${status.slice(1)}`

export function AppointmentDetailPanel({
  appointment: initialAppointment,
  onClose,
  onReschedule,
  onRebook,
  canManage,
}: Props) {
  const queryClient = useQueryClient()
  const { t: td } = useTranslation('appointments')
  const { t: tc } = useTranslation('common')
  // Held locally so the drawer can stay open and reflect each status action (QA-027).
  const [a, setA] = useState(initialAppointment)
  useEffect(() => setA(initialAppointment), [initialAppointment])
  // Owner-only actions on the API (AppointmentActionEndpoints: ClinicOwner, SuperAdmin).
  const isAdmin = useAuthStore((s) =>
    s.user?.roles?.some((r) => r === 'ClinicOwner' || r === 'SuperAdmin') ?? false
  )
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [showBilling, setShowBilling] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(a.notes ?? '')
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideNewStatus, setOverrideNewStatus] = useState<AppointmentStatus>('Scheduled')
  const [overrideReason, setOverrideReason] = useState('')
  // Escape closes the drawer unless a dialog on top of it should get the key (QA-027).
  useEscapeKey(onClose, !confirmCancel && !showOverride && !showCreateInvoice)

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
    // The history query used to be fetched once and never refreshed (QA-017).
    // Includes ['appointment-history', a.id], the calendar, dashboard and free slots.
    invalidateAppointmentQueries(queryClient)
  }

  const statusMutation = useMutation({
    mutationFn: (next: AppointmentStatus) => appointmentService.updateStatus(a.id, next),
    onSuccess: (updated) => { setA(updated); invalidate() },
  })

  const cancelMutation = useMutation({
    mutationFn: () => appointmentService.cancel(a.id),
    onSuccess: (updated) => { setA(updated); invalidate(); setConfirmCancel(false) },
  })

  const notesMutation = useMutation({
    mutationFn: (notes: string | null) => appointmentService.updateNotes(a.id, notes),
    onSuccess: () => {
      invalidate()
      setEditingNotes(false)
    },
  })

  const overrideMutation = useMutation({
    mutationFn: () => appointmentService.overrideStatus(a.id, overrideNewStatus, overrideReason || undefined),
    onSuccess: (updated) => {
      setA(updated)
      invalidate()
      setShowOverride(false)
      setOverrideReason('')
    },
  })

  const apptType = types?.find((t) => t.id === a.appointmentTypeId)
  const isTerminal = ['Completed', 'Cancelled', 'NoShow'].includes(a.status)
  // Mirrors the API: only a visit that has not started can be moved or cancelled (QA-034).
  const notStarted = ['Scheduled', 'CheckedIn'].includes(a.status)

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
      <div className="relative z-50 w-[420px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-600">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{td('detail.title')}</h2>
            <StatusBadge status={a.status} colorMap={STATUS_COLORS} labelMap={{ [a.status]: tc(statusKey(a.status)) }} className="mt-1" />
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          <AllergyAlert patientId={a.patientId} className="mb-2" />
          <DetailRow
            icon={User}
            label={td('detail.patient')}
            value={
              patient ? (
                <a
                  href={`/patients/${a.patientId}`}
                  className="text-primary-600 hover:underline font-medium dark:text-primary-400"
                >
                  {patient.fullName}
                </a>
              ) : (
                <span className="text-gray-500 italic dark:text-gray-400">{td('detail.loading')}</span>
              )
            }
          />
          <DetailRow
            icon={Stethoscope}
            label={td('detail.provider')}
            value={provider?.fullName ?? <span className="text-gray-500 italic dark:text-gray-400">{td('detail.loading')}</span>}
          />
          <DetailRow
            icon={CalendarDays}
            label={td('detail.dateTime')}
            value={`${formatDT(a.startAt)} → ${new Date(a.endAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}`}
          />
          <DetailRow
            icon={Clock}
            label={td('detail.duration')}
            value={td('detail.minutes', { count: a.durationMinutes })}
          />
          {apptType && (
            <DetailRow
              icon={FileText}
              label={td('detail.type')}
              value={apptType.name}
            />
          )}
          {a.chiefComplaint && (
            <DetailRow
              icon={MessageSquare}
              label={td('detail.chiefComplaint')}
              value={a.chiefComplaint}
            />
          )}

          {/* Notes with inline editing */}
          <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
            <FileText size={15} className="text-gray-500 mt-0.5 shrink-0 dark:text-gray-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium dark:text-gray-400">{td('detail.notes')}</p>
                {canManage && !editingNotes && (
                  <button
                    onClick={() => { setNotesDraft(a.notes ?? ''); setEditingNotes(true) }}
                    className="text-gray-500 hover:text-primary-600 p-0.5 rounded dark:text-gray-400"
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
                    className="w-full border border-gray-300 rounded text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => notesMutation.mutate(notesDraft || null)}
                      disabled={notesMutation.isPending}
                      className="flex items-center gap-1 text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 disabled:opacity-50"
                    >
                      <Check size={11} /> {td('detail.save')}
                    </button>
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
                    >
                      {td('detail.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-800 mt-0.5 dark:text-gray-100">
                  {a.notes ? (
                    <span className="whitespace-pre-wrap">{a.notes}</span>
                  ) : (
                    <span className="text-gray-500 italic text-xs dark:text-gray-400">{td('detail.noNotes')}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {a.cancellationReason && (
            <DetailRow
              icon={AlertCircle}
              label={td('detail.cancellationReason')}
              value={a.cancellationReason}
            />
          )}
          {a.isNewPatient && (
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                {td('detail.newPatient')}
              </span>
            </div>
          )}

          {/* Billing section */}
          <div className="pt-2">
            <button
              onClick={() => setShowBilling((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 py-2 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <span className="flex items-center gap-2">
                <Receipt size={14} className="text-gray-500 dark:text-gray-400" />
                {td('detail.patientInvoices')}
              </span>
              {showBilling ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showBilling && (
              <div className="mt-1 space-y-1.5">
                {!invoices ? (
                  <p className="text-xs text-gray-500 italic dark:text-gray-400">{td('detail.loading')}</p>
                ) : invoices.items.length === 0 ? (
                  <p className="text-xs text-gray-500 italic dark:text-gray-400">{td('detail.noInvoices')}</p>
                ) : (
                  invoices.items.map((inv) => (
                    <a
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-primary-200 hover:bg-primary-50 transition-colors dark:hover:bg-primary-400/10"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-100">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatShortDate(inv.issuedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={inv.status} colorMap={INVOICE_STATUS_COLORS} labelMap={INVOICE_STATUS_LABELS} />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {inv.balanceDue.toFixed(2)} KM due
                        </span>
                      </div>
                    </a>
                  ))
                )}
                <a
                  href={`/patients/${a.patientId}?tab=billing`}
                  className="block text-xs text-primary-600 hover:underline pt-1 dark:text-primary-400"
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
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 py-2 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <span className="flex items-center gap-2">
                <History size={14} className="text-gray-500 dark:text-gray-400" />
                {td('detail.statusHistory')}
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div className="mt-1 space-y-1.5">
                {!history ? (
                  <p className="text-xs text-gray-500 italic dark:text-gray-400">{td('detail.loading')}</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-gray-500 italic dark:text-gray-400">{td('detail.noHistory')}</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0 dark:text-gray-300">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                      <div className="flex-1">
                        <span className="font-medium">{h.fromStatus ? tc(statusKey(h.fromStatus)) : '—'}</span>
                        <span className="mx-1 text-gray-500 dark:text-gray-400">→</span>
                        <span className="font-medium" data-testid="history-to">{tc(statusKey(h.toStatus))}</span>
                        {h.isOverride && (
                          <span className="ml-1.5 text-orange-600 font-medium">(override)</span>
                        )}
                        {h.reason && <p className="text-gray-500 mt-0.5 dark:text-gray-400">{h.reason}</p>}
                        <p className="text-gray-500 mt-0.5 dark:text-gray-400">
                          {new Date(h.changedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
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
          <div className="border-t border-gray-200 px-5 py-4 space-y-2 dark:border-gray-600">
            {/* Primary lifecycle action */}
            {a.status === 'Scheduled' && (
              <div className="flex gap-2">
                <button
                  onClick={() => statusMutation.mutate('CheckedIn')}
                  disabled={statusMutation.isPending}
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {td('detail.checkIn')}
                </button>
                <button
                  onClick={() => statusMutation.mutate('InProgress')}
                  disabled={statusMutation.isPending}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {td('detail.startTreatment')}
                </button>
              </div>
            )}
            {a.status === 'CheckedIn' && (
              <button
                onClick={() => statusMutation.mutate('InProgress')}
                disabled={statusMutation.isPending}
                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? td('detail.updating') : td('detail.startTreatment')}
              </button>
            )}
            {a.status === 'InProgress' && (
              <button
                onClick={() => statusMutation.mutate('Completed')}
                disabled={statusMutation.isPending}
                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? td('detail.updating') : td('detail.complete')}
              </button>
            )}

            {/* Secondary row */}
            <div className="flex gap-2">
              {a.status === 'Scheduled' && (
                <button
                  onClick={() => statusMutation.mutate('NoShow')}
                  disabled={statusMutation.isPending}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
                >
                  {td('detail.noShow')}
                </button>
              )}
              {notStarted && (
                <button
                  onClick={() => onReschedule(a)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
                >
                  {td('detail.reschedule')}
                </button>
              )}
              {notStarted && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="flex-1 border border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors dark:border-red-400/30 dark:hover:bg-red-400/10 dark:text-red-300"
                >
                  {td('detail.cancelAppointment')}
                </button>
              )}
              {isTerminal && onRebook && (
                <button
                  onClick={() => onRebook(a)}
                  className="flex-1 border border-primary-200 text-primary-600 py-2 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors dark:border-primary-400/30 dark:hover:bg-primary-400/10 dark:text-primary-300"
                >
                  {td('detail.rebook')}
                </button>
              )}
            </div>

            {/* Bill patient — available for any non-void/non-cancelled status */}
            {a.status !== 'Cancelled' && a.status !== 'NoShow' && (
              <button
                onClick={() => setShowCreateInvoice(true)}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  a.status === 'Completed'
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {a.status === 'Completed' ? td('detail.billPatient') : td('detail.createInvoice')}
              </button>
            )}

            {/* Admin override */}
            {isAdmin && (
              <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                {!showOverride ? (
                  <button
                    onClick={() => { setOverrideNewStatus(a.status); setShowOverride(true) }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-600 transition-colors dark:text-gray-400"
                  >
                    <ShieldAlert size={13} />
                    {td('detail.overrideButton')}
                  </button>
                ) : (
                  <div className="space-y-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                      <ShieldAlert size={13} />
                      {td('detail.overrideHint')}
                    </p>
                    <select
                      value={overrideNewStatus}
                      onChange={(e) => setOverrideNewStatus(e.target.value as AppointmentStatus)}
                      className="w-full border border-orange-200 dark:border-orange-700 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {(['Scheduled', 'CheckedIn', 'InProgress', 'Completed', 'Cancelled', 'NoShow'] as AppointmentStatus[]).map((s) => (
                        <option key={s} value={s}>{tc(statusKey(s))}</option>
                      ))}
                    </select>
                    <input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder={td('detail.overrideReason')}
                      className="w-full border border-orange-200 dark:border-orange-700 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOverride(false)}
                        className="flex-1 text-sm text-gray-500 hover:text-gray-700 py-1 dark:text-gray-400"
                      >
                        {td('detail.cancel')}
                      </button>
                      <button
                        disabled={overrideMutation.isPending}
                        onClick={() => overrideMutation.mutate()}
                        className="flex-1 bg-primary-600 text-white py-1.5 rounded text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {overrideMutation.isPending ? td('detail.applying') : td('detail.apply')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={td('detail.cancelTitle')}
        description={td('detail.cancelBody')}
        confirmLabel={td('detail.cancelConfirm')}
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

