import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { staffService, STAFF_TYPE_LABELS } from '../services/staffService'
import { EditStaffDrawer } from '../components/EditStaffDrawer'
import { StaffBlockedTimesTab } from '../components/StaffBlockedTimesTab'

type Tab = 'overview' | 'absence'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">
        {value ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
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
  const [tab, setTab] = useState<Tab>('overview')

  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffService.getById(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">{tc('loading')}</div>
    )
  }

  if (error || !staff) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500 mb-3">{t('notFound')}</p>
        <Link to="/staff" className="text-indigo-600 text-sm hover:underline">{t('backToStaff')}</Link>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tab.overview') },
    { key: 'absence', label: t('tab.absence') },
  ]

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400">
        <Link to="/staff" className="hover:text-indigo-600 dark:hover:text-indigo-400">{t('title')}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-800 dark:text-gray-100">{staff.fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0"
            style={{ backgroundColor: staff.colorHex ?? '#3B82F6' }}
          >
            {staff.firstName[0]}{staff.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{staff.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">{STAFF_TYPE_LABELS[staff.staffType]}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  staff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {staff.isActive ? tc('status.active') : tc('status.inactive')}
              </span>
            </div>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            {tc('button.edit')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
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
          <Section title={t('section.contact')}>
            <Field label={t('field.email')} value={staff.email} />
            <Field label={t('field.phone')} value={staff.phone} />
          </Section>

          <Section title={t('section.employment')}>
            <Field label={t('field.staffType')} value={STAFF_TYPE_LABELS[staff.staffType]} />
            <Field label={t('field.specialty')} value={staff.specialty} />
            <Field label={t('field.hireDate')} value={staff.hireDate ?? undefined} />
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

      {showEdit && (
        <EditStaffDrawer staff={staff} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
