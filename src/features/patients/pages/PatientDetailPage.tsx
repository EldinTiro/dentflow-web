import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { patientService, type PatientStatus, type AddEmergencyContactRequest, type AddAllergyRequest, type UpsertMedicalHistoryRequest } from '../services/patientService'
import { EditPatientDrawer } from '../components/EditPatientDrawer'
import {
  appointmentService,
  STATUS_COLORS,
} from '@/features/appointments/services/appointmentService'
import { useAppointmentStatusLabels } from '@/features/appointments/hooks/useAppointmentStatusLabels'
import { AppointmentDetailPanel } from '@/features/appointments/components/AppointmentDetailPanel'
import { BookAppointmentDrawer } from '@/features/appointments/components/BookAppointmentDrawer'
import { RescheduleModal } from '@/features/appointments/components/RescheduleModal'
import { StatusBadge } from '@/shared/components/StatusBadge'
import type { AppointmentResponse } from '@/features/appointments/services/appointmentService'
import { TreatmentPlanTab } from '@/features/treatments/components/TreatmentPlanTab'
import { PatientFilesTab } from '../components/PatientFilesTab'
import { PatientBillingTab } from '@/features/billing/components/PatientBillingTab'
import { ConfirmDialog, useConfirm } from '@/shared/components/ConfirmDialog'
import { Trash2, Plus, AlertTriangle, Phone, User, Heart, CalendarPlus } from 'lucide-react'
import { AllergyAlert } from '../components/AllergyAlert'
import { DeactivatePatientDialog } from '../components/DeactivatePatientDialog'
import { toast } from 'sonner'
import { getApiErrorCodes, getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/lib/format'
import { can } from '@/shared/lib/permissions'

type Tab = 'overview' | 'appointments' | 'treatments' | 'files' | 'billing' | 'medical'
const TABS: Tab[] = ['overview', 'appointments', 'treatments', 'medical', 'files', 'billing']

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300',
  Inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300',
  Transferred: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{value ?? <span className="text-gray-500 dark:text-gray-400">—</span>}</dd>
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
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  // The active tab lives in ?tab= so a reload or a shared link keeps it (QA-028).
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (TABS.includes(searchParams.get('tab') as Tab) ? searchParams.get('tab') : 'overview') as Tab
  const setTab = (next: Tab) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      if (next === 'overview') n.delete('tab'); else n.set('tab', next)
      return n
    }, { replace: true })
  const [selectedAppt, setSelectedAppt] = useState<AppointmentResponse | null>(null)
  const [rescheduling, setRescheduling] = useState<AppointmentResponse | null>(null)

  const roles = useAuthStore(selectRoles)
  const canManage = can(roles, 'patients.manage')

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

  // People-merge plan D9: delete is only for a duplicate without history.
  const deleteMutation = useMutation({
    mutationFn: () => patientService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate('/patients')
    },
    onError: (err) => {
      setConfirmDelete(false)
      toast.error(getApiErrorCodes(err).has('Patient.HasHistory')
        ? t('status.hasHistory')
        : getApiErrorMessage(err, t('toast.deleteFailed')))
    },
  })

  // D8 / D10: deactivate instead of delete; refused while appointments are ahead.
  const statusMutation = useMutation({
    mutationFn: (change: { active: true } | { active: false; reason: string }) =>
      change.active ? patientService.reactivate(id!) : patientService.deactivate(id!, change.reason),
    onSuccess: (p, change) => {
      setConfirmDeactivate(false)
      queryClient.setQueryData(['patient', id], p)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success(change.active ? t('status.reactivated') : t('status.deactivated'))
    },
    onError: (err) => {
      setConfirmDeactivate(false)
      const codes = getApiErrorCodes(err)
      toast.error(codes.has('Patient.HasUpcomingAppointments')
        ? t('status.upcoming', { count: Number(codes.get('Patient.HasUpcomingAppointments.count') ?? 0) })
        : getApiErrorMessage(err, t('status.failed')))
    },
  })

  if (isLoading) return <div className="p-8 text-gray-500 text-sm dark:text-gray-400">{tc('loading')}</div>
  if (isError || !patient) return (
    <div className="p-8">
      <p className="text-red-500 text-sm mb-3">{t('notFound')}</p>
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('backToPatients')}</Link>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 block">
        {t('backToPatients')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{patient.fullName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[patient.status]}`}>
              {tc(`status.${patient.status.toLowerCase()}`)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{patient.patientNumber}</p>
          {patient.preferredName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('goesBy', { name: patient.preferredName })}</p>
          )}
          <AllergyAlert patientId={patient.id} className="mt-2" />
          {patient.parentName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('parentGuardian')} <span className="font-medium text-gray-700 dark:text-gray-300">{patient.parentName}</span></p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && patient.status !== 'Inactive' && (
            <button
              onClick={() => setShowBook(true)}
              className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
            >
              <CalendarPlus size={16} aria-hidden="true" />
              {t('button.bookAppointment')}
            </button>
          )}
          <button
            onClick={() => setShowEdit(true)}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {tc('button.edit')}
          </button>
          {canManage && patient.status !== 'Inactive' && (
            <button
              onClick={() => setConfirmDeactivate(true)}
              className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('status.deactivate')}
            </button>
          )}
          {/* Only a duplicate without history can be deleted (D9, DT-19). */}
          {canManage && !patient.hasHistory && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-red-600 px-2 py-2 rounded-md text-xs font-medium hover:bg-red-50 dark:hover:bg-red-400/10 dark:text-red-300"
            >
              {t('status.deleteDuplicate')}
            </button>
          )}
        </div>
      </div>

      {patient.status === 'Inactive' && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <span>
            {patient.deactivatedAt
              ? t('status.inactiveSince', { date: formatDate(patient.deactivatedAt) })
              : t('status.inactiveBanner')}
            {patient.deactivationReason && <> — {patient.deactivationReason}</>}
          </span>
          {canManage && (
            <button
              onClick={() => statusMutation.mutate({ active: true })}
              disabled={statusMutation.isPending}
              className="border border-amber-300 dark:border-amber-400/40 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-400/20 disabled:opacity-50"
            >
              {t('status.reactivate')}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label={patient.fullName} className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {([
          { key: 'overview', label: t('tab.overview') },
          { key: 'appointments', label: t('tab.appointments') },
          { key: 'treatments', label: t('tab.treatments') },
          { key: 'medical', label: t('tab.medical') },
          { key: 'files', label: t('tab.files') },
          { key: 'billing', label: t('tab.billing') },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
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
        <TreatmentPlanTab patientId={id!} canManage={can(roles, 'treatments.manage')} />
      ) : tab === 'medical' ? (
        <MedicalTab patientId={id!} canManage={canManage} />
      ) : tab === 'files' ? (
        <PatientFilesTab patientId={id!} canManage={canManage} />
      ) : tab === 'billing' ? (
        <PatientBillingTab patientId={id!} />
      ) : (
      <div className="space-y-4">
        {/* Demographics */}
        <Section title={t('section.demographics')}>
          <Field label={t('field.dateOfBirth')} value={formatDate(patient.dateOfBirth)} />
          <Field label={t('field.gender')} value={patient.gender} />
          <Field label={t('field.preferredContact')} value={patient.preferredContactMethod} />
          <Field label={t('field.firstVisit')} value={formatDate(patient.firstVisitDate)} />
          <Field label={t('field.lastVisit')} value={formatDate(patient.lastVisitDate)} />
          <Field label={t('field.recallDue')} value={formatDate(patient.recallDueDate)} />
        </Section>

        {/* Contact */}
        <Section title={t('section.contactInfo')}>
          <Field label={t('field.email')} value={patient.email} />
          <Field label={t('field.mobile')} value={patient.phoneMobile} />
          <Field label={t('field.home')} value={patient.phoneHome} />
          <Field label={t('field.work')} value={patient.phoneWork} />
          <Field label={t('field.smsOptIn')} value={patient.smsOptIn ? tc('boolean.yes') : tc('boolean.no')} />
          <Field label={t('field.emailOptIn')} value={patient.emailOptIn ? tc('boolean.yes') : tc('boolean.no')} />
        </Section>

        {/* Address */}
        {(patient.addressLine1 || patient.city) && (
          <Section title={t('section.address')}>
            <Field label={t('field.addressLine1')} value={patient.addressLine1} />
            <Field label={t('field.addressLine2')} value={patient.addressLine2} />
            <Field label={t('field.city')} value={patient.city} />
            <Field label={t('field.stateProvince')} value={patient.stateProvince} />
            <Field label={t('field.postalCode')} value={patient.postalCode} />
            <Field label={t('field.country')} value={patient.countryCode} />
          </Section>
        )}

        {/* Notes */}
        {patient.notes && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('section.notes')}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-6 pt-1">
          <span>{t('meta.created')} {formatDate(patient.createdAt)}</span>
          {patient.updatedAt && (
            <span>{t('meta.updated')} {formatDate(patient.updatedAt)}</span>
          )}
        </div>
      </div>
      )} {/* end tab === overview */}

      {showEdit && (
        <EditPatientDrawer patient={patient} onClose={() => setShowEdit(false)} />
      )}
      {showBook && (
        <BookAppointmentDrawer
          onClose={() => setShowBook(false)}
          initialPatient={{
            id: patient.id,
            patientNumber: patient.patientNumber,
            fullName: patient.fullName,
            phoneMobile: patient.phoneMobile ?? null,
            email: patient.email ?? null,
          }}
        />
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

      {confirmDeactivate && (
        <DeactivatePatientDialog
          name={patient.fullName}
          isPending={statusMutation.isPending}
          onConfirm={(reason) => statusMutation.mutate({ active: false, reason })}
          onCancel={() => setConfirmDeactivate(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('status.deleteDuplicateTitle')}
        description={<><strong>{patient.fullName}</strong> {t('status.deleteDuplicateBody')}</>}
        confirmLabel={t('status.deleteDuplicate')}
        cancelLabel={tc('button.cancel')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
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
  const { t } = useTranslation('patients')
  const statusLabels = useAppointmentStatusLabels()
  const { t: tc } = useTranslation('common')
  if (appointments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.emptyState')}</p>
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
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 font-medium">
        {totalCount} appointment{totalCount !== 1 ? 's' : ''} {tc('total')}
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
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs dark:text-gray-400">{a.chiefComplaint}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">{a.durationMinutes} min</span>
              <StatusBadge status={a.status} colorMap={STATUS_COLORS} labelMap={statusLabels} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MedicalTab({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const confirm = useConfirm()

  // — Emergency contacts —
  const { data: contacts = [] } = useQuery({
    queryKey: ['patient-emergency-contacts', patientId],
    queryFn: () => patientService.listEmergencyContacts(patientId),
  })
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState<AddEmergencyContactRequest>({ name: '', relationship: '', phonePrimary: '', isPrimary: false })
  const addContactMutation = useMutation({
    mutationFn: () => patientService.addEmergencyContact(patientId, contactForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-emergency-contacts', patientId] }); setShowAddContact(false); setContactForm({ name: '', relationship: '', phonePrimary: '', isPrimary: false }) },
  })
  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => patientService.deleteEmergencyContact(patientId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-emergency-contacts', patientId] }),
  })

  // — Allergies —
  const { data: allergies = [] } = useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: () => patientService.listAllergies(patientId),
  })
  const [showAddAllergy, setShowAddAllergy] = useState(false)
  const [allergyForm, setAllergyForm] = useState<AddAllergyRequest>({ allergen: '', reaction: '', severity: '', notes: '' })
  const addAllergyMutation = useMutation({
    mutationFn: () => patientService.addAllergy(patientId, allergyForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-allergies', patientId] }); setShowAddAllergy(false); setAllergyForm({ allergen: '', reaction: '', severity: '', notes: '' }) },
  })
  // DT-10: removing an allergy hides a clinical warning, so it is confirmed and announced.
  const deleteAllergyMutation = useMutation({
    mutationFn: (id: string) => patientService.deleteAllergy(patientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-allergies', patientId] })
      toast.success(t('medical.allergyRemoved'))
    },
    onError: (err) => toast.error(getApiErrorMessage(err, t('medical.allergyRemoveFailed'))),
  })

  // — Medical history —
  const { data: medHistory } = useQuery({
    queryKey: ['patient-medical-history', patientId],
    queryFn: () => patientService.getMedicalHistory(patientId),
  })

  const defaultMedForm: UpsertMedicalHistoryRequest = {
    bloodType: '', isPregnant: null, isSmoker: false, isDiabetic: false,
    hasHeartCondition: false, hasHypertension: false, hasBleedingDisorder: false,
    isOnBloodThinners: false, hasPacemaker: false, hasArtificialJoints: false,
    hasLatexAllergy: false, generalNotes: '', currentMedications: '', physicianName: '', physicianPhone: '',
  }
  const [medForm, setMedForm] = useState<UpsertMedicalHistoryRequest>(defaultMedForm)
  const [editingMed, setEditingMed] = useState(false)

  useEffect(() => {
    if (medHistory) {
      setMedForm({
        bloodType: medHistory.bloodType ?? '',
        isPregnant: medHistory.isPregnant ?? null,
        isSmoker: medHistory.isSmoker,
        isDiabetic: medHistory.isDiabetic,
        hasHeartCondition: medHistory.hasHeartCondition,
        hasHypertension: medHistory.hasHypertension,
        hasBleedingDisorder: medHistory.hasBleedingDisorder,
        isOnBloodThinners: medHistory.isOnBloodThinners,
        hasPacemaker: medHistory.hasPacemaker,
        hasArtificialJoints: medHistory.hasArtificialJoints,
        hasLatexAllergy: medHistory.hasLatexAllergy,
        generalNotes: medHistory.generalNotes ?? '',
        currentMedications: medHistory.currentMedications ?? '',
        physicianName: medHistory.physicianName ?? '',
        physicianPhone: medHistory.physicianPhone ?? '',
      })
    }
  }, [medHistory])

  const upsertMedMutation = useMutation({
    mutationFn: () => patientService.upsertMedicalHistory(patientId, medForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-medical-history', patientId] }); setEditingMed(false) },
  })

  const cardCls = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'
  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCls = 'text-xs text-gray-500 dark:text-gray-400 font-medium'

  const SEVERITY_COLORS: Record<string, string> = {
    Mild: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-400/10 dark:border-yellow-400/30 dark:text-yellow-300',
    Moderate: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-400/10 dark:border-orange-400/30 dark:text-orange-300',
    Severe: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-400/10 dark:border-red-400/30 dark:text-red-300',
    LifeThreatening: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-400/10 dark:border-red-400/30 dark:text-red-300',
  }

  return (
    <div className="space-y-4">
      {confirm.dialog}
      {/* ── Emergency Contacts ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <Phone size={13} /> {t('medical.emergencyContacts')}
          </h2>
          {canManage && (
            <button onClick={() => setShowAddContact(!showAddContact)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 dark:text-primary-400">
              <Plus size={13} /> {t('medical.add')}
            </button>
          )}
        </div>

        {showAddContact && (
          <div className="mx-5 mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('medical.contactName')}</label>
                <input className={inputCls} value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder={t('medical.contactNamePlaceholder')} />
              </div>
              <div>
                <label className={labelCls}>{t('medical.relationship')}</label>
                <input className={inputCls} value={contactForm.relationship ?? ''} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} placeholder={t('medical.relationshipPlaceholder')} />
              </div>
              <div>
                <label className={labelCls}>{t('medical.phone')}</label>
                <input className={inputCls} value={contactForm.phonePrimary ?? ''} onChange={e => setContactForm(f => ({ ...f, phonePrimary: e.target.value }))} placeholder="+387..." />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))} className="rounded" />
                  {t('medical.primaryContact')}
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddContact(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 dark:text-gray-400">{t('medical.cancel')}</button>
              <button
                disabled={!contactForm.name.trim() || addContactMutation.isPending}
                onClick={() => addContactMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {addContactMutation.isPending ? t('medical.saving') : t('medical.save')}
              </button>
            </div>
          </div>
        )}

        {contacts.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">{t('medical.noContacts')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {contacts.map(c => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <User size={15} className="text-gray-500 shrink-0 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      {c.name}
                      {c.isPrimary && <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400 px-1.5 py-0.5 rounded-full font-medium">{t('medical.primary')}</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.relationship}{c.phonePrimary ? ` · ${c.phonePrimary}` : ''}</p>
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => deleteContactMutation.mutate(c.id)} aria-label={t('medical.removeContact', { name: c.name })} title={t('medical.removeContact', { name: c.name })} className="text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Allergies ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle size={13} /> {t('medical.allergies')}
          </h2>
          {canManage && (
            <button onClick={() => setShowAddAllergy(!showAddAllergy)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 dark:text-primary-400">
              <Plus size={13} /> {t('medical.add')}
            </button>
          )}
        </div>

        {showAddAllergy && (
          <div className="mx-5 mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('medical.allergen')}</label>
                <input className={inputCls} value={allergyForm.allergen} onChange={e => setAllergyForm(f => ({ ...f, allergen: e.target.value }))} placeholder={t('medical.allergenPlaceholder')} />
              </div>
              <div>
                <label className={labelCls}>{t('medical.severity')}</label>
                <select className={inputCls} value={allergyForm.severity ?? ''} onChange={e => setAllergyForm(f => ({ ...f, severity: e.target.value || null }))}>
                  <option value="">—</option>
                  <option value="Mild">{t('allergySeverity.Mild')}</option>
                  <option value="Moderate">{t('allergySeverity.Moderate')}</option>
                  <option value="Severe">{t('allergySeverity.Severe')}</option>
                  <option value="LifeThreatening">{t('allergySeverity.LifeThreatening')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('medical.reaction')}</label>
                <input className={inputCls} value={allergyForm.reaction ?? ''} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder={t('medical.reactionPlaceholder')} />
              </div>
              <div>
                <label className={labelCls}>{t('medical.note')}</label>
                <input className={inputCls} value={allergyForm.notes ?? ''} onChange={e => setAllergyForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddAllergy(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 dark:text-gray-400">{t('medical.cancel')}</button>
              <button
                disabled={!allergyForm.allergen.trim() || addAllergyMutation.isPending}
                onClick={() => addAllergyMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {addAllergyMutation.isPending ? t('medical.saving') : t('medical.save')}
              </button>
            </div>
          </div>
        )}

        {allergies.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">{t('medical.noAllergies')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {allergies.map(a => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {a.allergen}
                      {a.severity && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[a.severity] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'}`}>
                          {t(`allergySeverity.${a.severity}`)}
                        </span>
                      )}
                    </p>
                    {a.reaction && <p className="text-xs text-gray-500 dark:text-gray-400">{a.reaction}</p>}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => confirm.ask({
                      title: t('medical.removeAllergyTitle'),
                      description: t('medical.removeAllergyBody', { allergen: a.allergen }),
                      confirmLabel: t('medical.removeAllergyConfirm'),
                      cancelLabel: tc('button.cancel'),
                      onConfirm: () => deleteAllergyMutation.mutate(a.id),
                    })}
                    aria-label={t('medical.removeAllergy', { allergen: a.allergen })}
                    title={t('medical.removeAllergy', { allergen: a.allergen })}
                    className="text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Medical History ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <Heart size={13} /> {t('medical.medicalHistory')}
          </h2>
          {canManage && !editingMed && (
            <button onClick={() => setEditingMed(true)} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
              {medHistory ? t('medical.edit') : t('medical.add')}
            </button>
          )}
        </div>

        {editingMed ? (
          <div className="px-5 pb-5 space-y-4">
            {/* Boolean conditions grid */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('medical.conditions')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([
                  ['isSmoker', t('medical.condition.isSmoker')],
                  ['isDiabetic', t('medical.condition.isDiabetic')],
                  ['hasHeartCondition', t('medical.condition.hasHeartCondition')],
                  ['hasHypertension', t('medical.condition.hasHypertension')],
                  ['hasBleedingDisorder', t('medical.condition.hasBleedingDisorder')],
                  ['isOnBloodThinners', t('medical.condition.isOnBloodThinners')],
                  ['hasPacemaker', t('medical.condition.hasPacemaker')],
                  ['hasArtificialJoints', t('medical.condition.hasArtificialJoints')],
                  ['hasLatexAllergy', t('medical.condition.hasLatexAllergy')],
                ] as [keyof UpsertMedicalHistoryRequest, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!medForm[key]}
                      onChange={e => setMedForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('medical.bloodType')}</label>
                <select className={inputCls} value={medForm.bloodType ?? ''} onChange={e => setMedForm(f => ({ ...f, bloodType: e.target.value || null }))}>
                  <option value="">—</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('medical.pregnancy')}</label>
                <select className={inputCls} value={medForm.isPregnant === null ? '' : medForm.isPregnant ? 'yes' : 'no'} onChange={e => setMedForm(f => ({ ...f, isPregnant: e.target.value === '' ? null : e.target.value === 'yes' }))}>
                  <option value="">—</option>
                  <option value="yes">{t('medical.yes')}</option>
                  <option value="no">{t('medical.no')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('medical.physicianName')}</label>
                <input className={inputCls} value={medForm.physicianName ?? ''} onChange={e => setMedForm(f => ({ ...f, physicianName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>{t('medical.physicianPhone')}</label>
                <input className={inputCls} value={medForm.physicianPhone ?? ''} onChange={e => setMedForm(f => ({ ...f, physicianPhone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t('medical.currentMedications')}</label>
                <textarea className={inputCls} rows={2} value={medForm.currentMedications ?? ''} onChange={e => setMedForm(f => ({ ...f, currentMedications: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t('medical.generalNotes')}</label>
                <textarea className={inputCls} rows={2} value={medForm.generalNotes ?? ''} onChange={e => setMedForm(f => ({ ...f, generalNotes: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingMed(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 dark:text-gray-400">{t('medical.cancel')}</button>
              <button
                disabled={upsertMedMutation.isPending}
                onClick={() => upsertMedMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {upsertMedMutation.isPending ? t('medical.saving') : t('medical.save')}
              </button>
            </div>
          </div>
        ) : medHistory ? (
          <div className="px-5 pb-5 space-y-4">
            {/* Active conditions */}
            {(() => {
              const flags = [
                medHistory.isSmoker && t('medical.condition.isSmoker'),
                medHistory.isDiabetic && t('medical.condition.isDiabetic'),
                medHistory.hasHeartCondition && t('medical.condition.hasHeartCondition'),
                medHistory.hasHypertension && t('medical.condition.hasHypertension'),
                medHistory.hasBleedingDisorder && t('medical.condition.hasBleedingDisorder'),
                medHistory.isOnBloodThinners && t('medical.condition.isOnBloodThinners'),
                medHistory.hasPacemaker && t('medical.condition.hasPacemaker'),
                medHistory.hasArtificialJoints && t('medical.condition.hasArtificialJoints'),
                medHistory.hasLatexAllergy && t('medical.condition.hasLatexAllergy'),
              ].filter(Boolean) as string[]
              return flags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {flags.map(f => (
                    <span key={f} className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full font-medium">{f}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic dark:text-gray-400">{t('medical.noConditions')}</p>
              )
            })()}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {medHistory.bloodType && <div><dt className="text-xs text-gray-500 dark:text-gray-400">{t('medical.bloodType')}</dt><dd className="text-sm font-medium text-gray-800 dark:text-gray-200">{medHistory.bloodType}</dd></div>}
              {medHistory.isPregnant !== null && <div><dt className="text-xs text-gray-500 dark:text-gray-400">{t('medical.pregnancy')}</dt><dd className="text-sm text-gray-800 dark:text-gray-200">{medHistory.isPregnant ? t('medical.yes') : t('medical.no')}</dd></div>}
              {medHistory.physicianName && <div><dt className="text-xs text-gray-500 dark:text-gray-400">{t('medical.physician')}</dt><dd className="text-sm text-gray-800 dark:text-gray-200">{medHistory.physicianName}{medHistory.physicianPhone ? ` · ${medHistory.physicianPhone}` : ''}</dd></div>}
              {medHistory.currentMedications && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-gray-500 mb-0.5 dark:text-gray-400">{t('medical.medications')}</dt><dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{medHistory.currentMedications}</dd></div>}
              {medHistory.generalNotes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-gray-500 mb-0.5 dark:text-gray-400">{t('medical.notes')}</dt><dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{medHistory.generalNotes}</dd></div>}
            </dl>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">{t('medical.noHistory')}</p>
        )}
      </div>
    </div>
  )
}
