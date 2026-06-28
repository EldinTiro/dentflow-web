import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { patientService, type PatientStatus, type AddEmergencyContactRequest, type AddAllergyRequest, type UpsertMedicalHistoryRequest } from '../services/patientService'
import { EditPatientDrawer } from '../components/EditPatientDrawer'
import {
  appointmentService,
  APPOINTMENT_STATUS_LABELS,
  STATUS_COLORS,
  type AppointmentStatus,
} from '@/features/appointments/services/appointmentService'
import { AppointmentDetailPanel } from '@/features/appointments/components/AppointmentDetailPanel'
import { RescheduleModal } from '@/features/appointments/components/RescheduleModal'
import { StatusBadge } from '@/shared/components/StatusBadge'
import type { AppointmentResponse } from '@/features/appointments/services/appointmentService'
import { TreatmentPlanTab } from '@/features/treatments/components/TreatmentPlanTab'
import { PatientFilesTab } from '../components/PatientFilesTab'
import { PatientBillingTab } from '@/features/billing/components/PatientBillingTab'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Trash2, Plus, AlertTriangle, Phone, User, Heart, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react'

type Tab = 'overview' | 'appointments' | 'treatments' | 'files' | 'billing' | 'medical'

const STATUS_STYLES: Record<PatientStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Transferred: 'bg-blue-100 text-blue-700',
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
  const { t } = useTranslation('patients')
  const tc = useTranslation('common').t
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

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">{tc('loading')}</div>
  if (isError || !patient) return (
    <div className="p-8">
      <p className="text-red-500 text-sm mb-3">{t('notFound')}</p>
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('backToPatients')}</Link>
    </div>
  )

  const formatDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString() : null

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/patients" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 block">
        {t('backToPatients')}
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('goesBy', { name: patient.preferredName })}</p>
          )}
          {patient.parentName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('parentGuardian')} <span className="font-medium text-gray-700 dark:text-gray-300">{patient.parentName}</span></p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {tc('button.edit')}
          </button>
          {canManage && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50"
            >
              {tc('button.delete')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {([
          { key: 'overview', label: t('tab.overview') },
          { key: 'appointments', label: t('tab.appointments') },
          { key: 'treatments', label: t('tab.treatments') },
          { key: 'medical', label: 'Medicinsko' },
          { key: 'files', label: t('tab.files') },
          { key: 'billing', label: t('tab.billing') },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-600'
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
        <div className="text-xs text-gray-400 dark:text-gray-500 flex gap-6 pt-1">
          <span>{t('meta.created')} {new Date(patient.createdAt).toLocaleDateString()}</span>
          {patient.updatedAt && (
            <span>{t('meta.updated')} {new Date(patient.updatedAt).toLocaleDateString()}</span>
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

      <ConfirmDialog
        open={confirmDelete}
        title={t('confirm.deleteTitle')}
        description={<><strong>{patient.fullName}</strong> {t('confirm.deleteDescription', { name: '' })}</>}
        confirmLabel={tc('button.delete')}
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
  const { t: tc } = useTranslation('common')
  if (appointments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
        <p className="text-sm text-gray-400">{t('appointments.emptyState')}</p>
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
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{a.chiefComplaint}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{a.durationMinutes} min</span>
              <StatusBadge status={a.status} colorMap={STATUS_COLORS} labelMap={APPOINTMENT_STATUS_LABELS} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MedicalTab({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient()

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
  const deleteAllergyMutation = useMutation({
    mutationFn: (id: string) => patientService.deleteAllergy(patientId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-allergies', patientId] }),
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
    Mild: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    Moderate: 'bg-orange-50 text-orange-700 border border-orange-200',
    Severe: 'bg-red-50 text-red-700 border border-red-200',
    LifeThreatening: 'bg-red-100 text-red-800 border border-red-300',
  }

  return (
    <div className="space-y-4">
      {/* ── Emergency Contacts ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <Phone size={13} /> Hitni kontakti
          </h2>
          {canManage && (
            <button onClick={() => setShowAddContact(!showAddContact)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              <Plus size={13} /> Dodaj
            </button>
          )}
        </div>

        {showAddContact && (
          <div className="mx-5 mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ime *</label>
                <input className={inputCls} value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Ime i prezime" />
              </div>
              <div>
                <label className={labelCls}>Srodstvo</label>
                <input className={inputCls} value={contactForm.relationship ?? ''} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Npr. Majka, Suprug" />
              </div>
              <div>
                <label className={labelCls}>Telefon</label>
                <input className={inputCls} value={contactForm.phonePrimary ?? ''} onChange={e => setContactForm(f => ({ ...f, phonePrimary: e.target.value }))} placeholder="+387..." />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))} className="rounded" />
                  Primarni kontakt
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddContact(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Odustani</button>
              <button
                disabled={!contactForm.name.trim() || addContactMutation.isPending}
                onClick={() => addContactMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {addContactMutation.isPending ? 'Čuvam…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        )}

        {contacts.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-400">Nema hitnih kontakata.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {contacts.map(c => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <User size={15} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      {c.name}
                      {c.isPrimary && <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400 px-1.5 py-0.5 rounded-full font-medium">Primarni</span>}
                    </p>
                    <p className="text-xs text-gray-400">{c.relationship}{c.phonePrimary ? ` · ${c.phonePrimary}` : ''}</p>
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => deleteContactMutation.mutate(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
            <AlertTriangle size={13} /> Alergije
          </h2>
          {canManage && (
            <button onClick={() => setShowAddAllergy(!showAddAllergy)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              <Plus size={13} /> Dodaj
            </button>
          )}
        </div>

        {showAddAllergy && (
          <div className="mx-5 mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Alergen *</label>
                <input className={inputCls} value={allergyForm.allergen} onChange={e => setAllergyForm(f => ({ ...f, allergen: e.target.value }))} placeholder="Npr. Penicilin, Latex" />
              </div>
              <div>
                <label className={labelCls}>Ozbiljnost</label>
                <select className={inputCls} value={allergyForm.severity ?? ''} onChange={e => setAllergyForm(f => ({ ...f, severity: e.target.value || null }))}>
                  <option value="">—</option>
                  <option value="Mild">Blaga</option>
                  <option value="Moderate">Umjerena</option>
                  <option value="Severe">Teška</option>
                  <option value="LifeThreatening">Životno ugrožavajuća</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Reakcija</label>
                <input className={inputCls} value={allergyForm.reaction ?? ''} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder="Npr. Osip, Anafilaksa" />
              </div>
              <div>
                <label className={labelCls}>Napomena</label>
                <input className={inputCls} value={allergyForm.notes ?? ''} onChange={e => setAllergyForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddAllergy(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Odustani</button>
              <button
                disabled={!allergyForm.allergen.trim() || addAllergyMutation.isPending}
                onClick={() => addAllergyMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {addAllergyMutation.isPending ? 'Čuvam…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        )}

        {allergies.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-400">Nema evidentiranih alergija.</p>
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[a.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                          {a.severity === 'Mild' ? 'Blaga' : a.severity === 'Moderate' ? 'Umjerena' : a.severity === 'Severe' ? 'Teška' : 'Životno ugr.'}
                        </span>
                      )}
                    </p>
                    {a.reaction && <p className="text-xs text-gray-400">{a.reaction}</p>}
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => deleteAllergyMutation.mutate(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
            <Heart size={13} /> Medicinska historija
          </h2>
          {canManage && !editingMed && (
            <button onClick={() => setEditingMed(true)} className="text-xs text-primary-600 hover:text-primary-700">
              {medHistory ? 'Uredi' : 'Dodaj'}
            </button>
          )}
        </div>

        {editingMed ? (
          <div className="px-5 pb-5 space-y-4">
            {/* Boolean conditions grid */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Medicinska stanja</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([
                  ['isSmoker', 'Pušač'],
                  ['isDiabetic', 'Dijabetes'],
                  ['hasHeartCondition', 'Srčano oboljenje'],
                  ['hasHypertension', 'Hipertenzija'],
                  ['hasBleedingDisorder', 'Poremećaj krvarenja'],
                  ['isOnBloodThinners', 'Antikoagulansi'],
                  ['hasPacemaker', 'Pejsmejker'],
                  ['hasArtificialJoints', 'Vještački zglobovi'],
                  ['hasLatexAllergy', 'Alergija na latex'],
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
                <label className={labelCls}>Krvna grupa</label>
                <select className={inputCls} value={medForm.bloodType ?? ''} onChange={e => setMedForm(f => ({ ...f, bloodType: e.target.value || null }))}>
                  <option value="">—</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Trudnoća</label>
                <select className={inputCls} value={medForm.isPregnant === null ? '' : medForm.isPregnant ? 'yes' : 'no'} onChange={e => setMedForm(f => ({ ...f, isPregnant: e.target.value === '' ? null : e.target.value === 'yes' }))}>
                  <option value="">—</option>
                  <option value="yes">Da</option>
                  <option value="no">Ne</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ime doktora</label>
                <input className={inputCls} value={medForm.physicianName ?? ''} onChange={e => setMedForm(f => ({ ...f, physicianName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Telefon doktora</label>
                <input className={inputCls} value={medForm.physicianPhone ?? ''} onChange={e => setMedForm(f => ({ ...f, physicianPhone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Trenutni lijekovi</label>
                <textarea className={inputCls} rows={2} value={medForm.currentMedications ?? ''} onChange={e => setMedForm(f => ({ ...f, currentMedications: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Opće napomene</label>
                <textarea className={inputCls} rows={2} value={medForm.generalNotes ?? ''} onChange={e => setMedForm(f => ({ ...f, generalNotes: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingMed(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Odustani</button>
              <button
                disabled={upsertMedMutation.isPending}
                onClick={() => upsertMedMutation.mutate()}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {upsertMedMutation.isPending ? 'Čuvam…' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        ) : medHistory ? (
          <div className="px-5 pb-5 space-y-4">
            {/* Active conditions */}
            {(() => {
              const flags = [
                medHistory.isSmoker && 'Pušač',
                medHistory.isDiabetic && 'Dijabetes',
                medHistory.hasHeartCondition && 'Srčano oboljenje',
                medHistory.hasHypertension && 'Hipertenzija',
                medHistory.hasBleedingDisorder && 'Poremećaj krvarenja',
                medHistory.isOnBloodThinners && 'Antikoagulansi',
                medHistory.hasPacemaker && 'Pejsmejker',
                medHistory.hasArtificialJoints && 'Vještački zglobovi',
                medHistory.hasLatexAllergy && 'Alergija na latex',
              ].filter(Boolean) as string[]
              return flags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {flags.map(f => (
                    <span key={f} className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full font-medium">{f}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Nema aktivnih medicinskih stanja.</p>
              )
            })()}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {medHistory.bloodType && <div><dt className="text-xs text-gray-400">Krvna grupa</dt><dd className="text-sm font-medium text-gray-800 dark:text-gray-200">{medHistory.bloodType}</dd></div>}
              {medHistory.isPregnant !== null && <div><dt className="text-xs text-gray-400">Trudnoća</dt><dd className="text-sm text-gray-800 dark:text-gray-200">{medHistory.isPregnant ? 'Da' : 'Ne'}</dd></div>}
              {medHistory.physicianName && <div><dt className="text-xs text-gray-400">Doktor</dt><dd className="text-sm text-gray-800 dark:text-gray-200">{medHistory.physicianName}{medHistory.physicianPhone ? ` · ${medHistory.physicianPhone}` : ''}</dd></div>}
              {medHistory.currentMedications && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-gray-400 mb-0.5">Lijekovi</dt><dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{medHistory.currentMedications}</dd></div>}
              {medHistory.generalNotes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-gray-400 mb-0.5">Napomene</dt><dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{medHistory.generalNotes}</dd></div>}
            </dl>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-gray-400">Medicinska historija nije unesena.</p>
        )}
      </div>
    </div>
  )
}
