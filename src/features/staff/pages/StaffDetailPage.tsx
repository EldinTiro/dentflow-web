import { useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router'
import { Mail, Phone, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore, selectRoles } from '@/features/auth/store/authStore'
import { staffService } from '../services/staffService'
import { EditStaffDrawer } from '../components/EditStaffDrawer'
import { StaffBlockedTimesTab } from '../components/StaffBlockedTimesTab'
import { StaffAccessSection } from '../components/StaffAccessSection'
import { peopleErrorMessage } from '../lib/peopleErrors'
import { useConfirm } from '@/shared/components/ConfirmDialog'
import { PermanentDeleteDialog } from '@/shared/components/PermanentDeleteDialog'
import { formatDate } from '@/shared/lib/format'
import { can } from '@/shared/lib/permissions'

type Tab = 'overview' | 'absence'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    // min-w-0 + break-words: a long email wrapped onto the next column (DT-15)
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words">
        {value || <span className="text-gray-500 dark:text-gray-400">—</span>}
      </dd>
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

export function StaffDetailPage() {
  const { t } = useTranslation('staff')
  const { t: tc } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const [showEdit, setShowEdit] = useState(false)
  // ?tab=absence opens the absences straight away (the dashboard's "who is away" links there)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'absence' ? 'absence' : 'overview'
  const setTab = (v: Tab) => setSearchParams(v === 'overview' ? {} : { tab: v }, { replace: true })

  const roles = useAuthStore(selectRoles)
  const canManage = can(roles, 'people.manage')
  const canPurge = can(roles, 'records.purge')
  const navigate = useNavigate()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffService.getById(id!),
    enabled: !!id,
  })

  // People-merge plan B6/B7: deactivate instead of delete; the API refuses while
  // appointments are ahead and keeps the sign-in off on reactivation.
  const setActive = useMutation({
    mutationFn: (active: boolean) => (active ? staffService.reactivate(id!) : staffService.deactivate(id!)),
    onSuccess: (s, active) => {
      toast.success(active ? t('status.reactivated', { name: s.fullName }) : t('status.deactivated', { name: s.fullName }))
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err) => toast.error(peopleErrorMessage(err, t, staff?.fullName ?? '')),
  })

  // The Administrator deletes for good (user request 2026-11-13); anyone who has worked stays
  const purge = useMutation({
    mutationFn: () => staffService.deletePermanently(id!),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['staff', id] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('purge.done'))
      navigate('/staff')
    },
    onError: (err) => {
      setConfirmPurge(false)
      toast.error(peopleErrorMessage(err, t, staff?.fullName ?? ''))
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{tc('loading')}</div>
    )
  }

  if (error || !staff) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500 mb-3">{t('notFound')}</p>
        <Link to="/staff" className="text-primary-600 text-sm hover:underline dark:text-primary-400">{t('backToStaff')}</Link>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tab.overview') },
    { key: 'absence', label: t('tab.absence') },
  ]

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link to="/staff" className="block text-sm text-primary-600 hover:underline dark:text-primary-400">
        {t('backToStaff')}
      </Link>

      {/* Header: who the person is and what can be done, like the patient record (2026-11-13) */}
      <section aria-label={staff.fullName} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: staff.colorHex ?? '#3B82F6' }}
          >
            {staff.firstName[0]}{staff.lastName[0]}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{staff.fullName}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                staff.isActive ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'
              }`}>
                {staff.isActive ? tc('status.active') : tc('status.inactive')}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {t(`staffType.${staff.staffType}`)}{staff.specialty ? ` · ${staff.specialty}` : ''}
              </span>
              {staff.phone && <a href={`tel:${staff.phone}`} className="inline-flex items-center gap-1 hover:text-primary-600"><Phone size={13} aria-hidden /> {staff.phone}</a>}
              {staff.email && <a href={`mailto:${staff.email}`} className="inline-flex min-w-0 items-center gap-1 break-all hover:text-primary-600"><Mail size={13} aria-hidden /> {staff.email}</a>}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="rounded-md border border-control px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {tc('button.edit')}
            </button>
            {staff.isActive ? (
              <button
                onClick={() => confirm.ask({
                  title: t('status.deactivateTitle', { name: staff.fullName }),
                  description: t('status.deactivateBody'),
                  confirmLabel: t('status.deactivate'),
                  cancelLabel: tc('button.cancel'),
                  onConfirm: () => setActive.mutate(false),
                })}
                disabled={setActive.isPending}
                className="rounded-md border border-control px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('status.deactivate')}
              </button>
            ) : (
              <button
                onClick={() => setActive.mutate(true)}
                disabled={setActive.isPending}
                className="rounded-md border border-control px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('status.reactivate')}
              </button>
            )}
            {canPurge && (
              <button
                onClick={() => setConfirmPurge(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10"
              >
                <Trash2 size={15} aria-hidden /> {tc('permanentDelete.confirm')}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Tabs */}
      <div role="tablist" aria-label={staff.fullName} className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <StaffAccessSection staff={staff} />

          <Section title={t('section.employment')}>
            <Field label={t('field.staffType')} value={t(`staffType.${staff.staffType}`)} />
            <Field label={t('field.specialty')} value={staff.specialty} />
            <Field label={t('field.hireDate')} value={staff.hireDate ? formatDate(staff.hireDate) : undefined} />
            <Field label={t('field.terminationDate')} value={staff.terminationDate ?? undefined} />
          </Section>

          {(staff.licenseNumber || staff.npiNumber || staff.licenseExpiry) && (
            <Section title={t('section.credentials')}>
              <Field label={t('field.licenseNumber')} value={staff.licenseNumber} />
              <Field label={t('field.licenseExpiry')} value={staff.licenseExpiry} />
              <Field label={t('field.npiNumber')} value={staff.npiNumber} />
            </Section>
          )}

          {staff.biography && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('section.biography')}</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{staff.biography}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'absence' && <StaffBlockedTimesTab staffId={id!} />}

      {confirm.dialog}

      <PermanentDeleteDialog
        open={confirmPurge}
        name={staff.fullName}
        title={t('purge.title')}
        description={t('purge.body')}
        isPending={purge.isPending}
        onConfirm={() => purge.mutate()}
        onCancel={() => setConfirmPurge(false)}
      />

      {showEdit && (
        <EditStaffDrawer staff={staff} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
