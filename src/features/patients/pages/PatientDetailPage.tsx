import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService, type PatientStatus } from '../services/patientService'
import { EditPatientDrawer } from '../components/EditPatientDrawer'

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Archived: 'bg-amber-100 text-amber-700',
  Deceased: 'bg-red-100 text-red-600',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value ?? <span className="text-gray-300">—</span>}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
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

  const canDelete = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientService.getById(id!),
    enabled: !!id,
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
      <Link to="/patients" className="text-sm text-blue-600 hover:underline">← Back to Patients</Link>
    </div>
  )

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString() : null

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/patients" className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Back to Patients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{patient.fullName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[patient.status]}`}>
              {patient.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono">{patient.patientNumber}</p>
          {patient.preferredName && (
            <p className="text-sm text-gray-500 mt-0.5">Goes by &ldquo;{patient.preferredName}&rdquo;</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Edit
          </button>
          {canDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

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
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-gray-400 flex gap-6 pt-1">
          <span>Created: {new Date(patient.createdAt).toLocaleDateString()}</span>
          {patient.updatedAt && (
            <span>Updated: {new Date(patient.updatedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {showEdit && (
        <EditPatientDrawer patient={patient} onClose={() => setShowEdit(false)} />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Patient?</h3>
            <p className="text-sm text-gray-500 mb-5">
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
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
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
