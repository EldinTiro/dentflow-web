import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService, type PatientStatus } from '../services/patientService'
import { EditPatientDrawer } from '../components/EditPatientDrawer'
import {
  appointmentService,
  APPOINTMENT_STATUS_LABELS,
  STATUS_COLORS,
  type AppointmentStatus,
} from '@/features/appointments/services/appointmentService'
import { AppointmentDetailPanel } from '@/features/appointments/components/AppointmentDetailPanel'
import { RescheduleModal } from '@/features/appointments/components/RescheduleModal'
import type { AppointmentResponse } from '@/features/appointments/services/appointmentService'
import { TreatmentPlanTab } from '@/features/treatments/components/TreatmentPlanTab'

type Tab = 'overview' | 'appointments' | 'treatments'

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Archived: 'bg-amber-100 text-amber-700',
  Deceased: 'bg-red-100 text-red-600',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{value ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {children}
      </dl>
    </div>
  )
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedAppt, setSelectedAppt] = useState<AppointmentResponse | null>(null)
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null)

  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'Receptionist', 'Dentist', 'Hygienist', 'SuperAdmin'].includes(r)) ?? false
  )

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(id!),
    enabled: !!id,
  })

  const { data: apptData } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () => appointmentService.list({ patientId: id!, pageSize: 50 }),
    enabled: !!id && tab === 'appointments',
  })

  const deleteMutation = useMutation({
    mutationFn: () => patientService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate('/patients')
    },
  })

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (isError || !patient) return (
    <div className="p-8">
      <p className="text-red-500 text-sm mb-3">Patient not found.</p>
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back to Patients</Link>
    </div>
  )

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString() : null

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 block">
        ← Back to Patients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{patient.fullName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[patient.status]}`}>
              {patient.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">{patient.patientNumber}</p>
          {patient.preferredName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Goes by &ldquo;{patient.preferredName}&rdquo;</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Edit
          </button>
          {canManage && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'appointments', label: 'Appointments' },
          { key: 'treatments', label: 'Treatments' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'appointments' ? (
        <AppointmentHistoryTab
          appointments={apptData?.items ?? []}
          totalCount={apptData?.totalCount ?? 0}
          onSelect={setSelectedAppt}
        />
      ) : tab === 'treatments' ? (
        <TreatmentPlanTab patientId={id!} canManage={canManage} />
      ) : (
      <div className="space-y-4">
        {/* Demographics */}
        <Section title="Demographics">
          <Field label="Date of Birth" value={formatDate(patient.dateOfBirth)} />
          <Field label="Gender" value={patient.gender} />
          <Field label="Preferred Contact" value={patient.preferredContactMethod} />
          <Field label="First Visit" value={formatDate(patient.firstVisitDate)} />
          <Field label="Last Visit" value={formatDate(patient.lastVisitDate)} />
          <Field label="Recall Due" value={formatDate(patient.recallDueDate)} />
        </Section>

        {/* Contact */}
        <Section title="Contact Information">
          <Field label="Email" value={patient.email} />
          <Field label="Mobile" value={patient.phoneMobile} />
          <Field label="Home" value={patient.phoneHome} />
          <Field label="Work" value={patient.phoneWork} />
          <Field label="SMS Opt-in" value={patient.smsOptIn ? 'Yes' : 'No'} />
          <Field label="Email Opt-in" value={patient.emailOptIn ? 'Yes' : 'No'} />
        </Section>

        {/* Address */}
        {(patient.addressLine1 || patient.city) && (
          <Section title="Address">
            <Field label="Address Line 1" value={patient.addressLine1} />
            <Field label="Address Line 2" value={patient.addressLine2} />
            <Field label="City" value={patient.city} />
            <Field label="State/Province" value={patient.stateProvince} />
            <Field label="Postal Code" value={patient.postalCode} />
            <Field label="Country" value={patient.countryCode} />
          </Section>
        )}

        {/* Notes */}
        {patient.notes && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notes</h2>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-gray-400 dark:text-gray-500 flex gap-6 pt-1">
          <span>Created: {new Date(patient.createdAt).toLocaleDateString()}</span>
          {patient.updatedAt && (
            <span>Updated: {new Date(patient.updatedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      )} {/* end tab === overview */}

      {showEdit && (
        <EditPatientDrawer patient={patient} onClose={() => setShowEdit(false)} />
      )}

      {selectedAppt && (
        <AppointmentDetailPanel
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onReschedule={(a) => { setRescheduling(a); setSelectedAppt(null) }}
          canManage={canManage}
        />
      )}

      {rescheduling && (
        <RescheduleModal appointment={rescheduling} onClose={() => setRescheduling(null)} />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Delete Patient?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              <strong>{patient.fullName}</strong> will be soft-deleted. This can be undone by an admin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppointmentHistoryTab({
  appointments,
  totalCount,
  onSelect,
}: {
  appointments: AppointmentResponse[]
  totalCount: number
  onSelect: (a: AppointmentResponse) => void
}) {
  if (appointments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
        <p className="text-sm text-gray-400">No appointments found for this patient.</p>
      </div>
    )
  }

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 font-medium">
        {totalCount} appointment{totalCount !== 1 ? 's' : ''} total
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {appointments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            onClick={() => onSelect(a)}
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDT(a.startAt)}</p>
              {a.chiefComplaint && (
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{a.chiefComplaint}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{a.durationMinutes} min</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[a.status as AppointmentStatus] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
