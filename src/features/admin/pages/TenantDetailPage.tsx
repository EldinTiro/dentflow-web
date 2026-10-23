import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { tenantService } from '../services/tenantService'
import { userAdminService, type UserAdminResponse } from '../services/userAdminService'
import { AddTenantUserModal } from '../components/AddTenantUserModal'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useConfirm } from '@/shared/components/ConfirmDialog'
import { TempPasswordBox } from '@/shared/components/TempPasswordBox'
import { formatDate } from '@/shared/lib/format'
import { TENANT_ROLES } from '@/shared/lib/permissions'

// The API takes the plan code; only the label is translated (QA-014).
const PLANS = [
  { value: 'Free', labelKey: 'tenant.detail.planFree' },
  { value: 'Pro', labelKey: 'tenant.detail.planPro' },
  { value: 'Enterprise', labelKey: 'tenant.detail.planEnterprise' },
] as const

const showError = (err: unknown) => toast.error(getApiErrorMessage(err))

type Tab = 'details' | 'users'

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function DetailsTab({ id }: { id: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const { data: tenant } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getById(id),
  })

  // Every mutation reports back: they used to fail (and succeed) silently (QA-014).
  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant', id] })
    queryClient.invalidateQueries({ queryKey: ['tenants'] })
    toast.success(tc('feedback.saved'))
  }
  const updateName = useMutation({
    mutationFn: ({ name }: { name: string }) => tenantService.update(id, { name: name.trim() }),
    onSuccess: onSaved,
    onError: showError,
  })
  const updatePlan = useMutation({
    mutationFn: ({ plan }: { plan: string }) => tenantService.updatePlan(id, { plan }),
    onSuccess: onSaved,
    onError: showError,
  })
  const activate = useMutation({
    mutationFn: () => tenantService.activate(id),
    onSuccess: onSaved,
    onError: showError,
  })
  const deactivate = useMutation({
    mutationFn: () => tenantService.deactivate(id),
    onSuccess: onSaved,
    onError: showError,
  })
  const confirm = useConfirm()

  const {
    register: regName,
    handleSubmit: submitName,
    formState: { errors: nameErrors },
  } = useForm<{ name: string }>({ values: { name: tenant?.name ?? '' } })
  const { register: regPlan, handleSubmit: submitPlan } = useForm<{ plan: string }>({
    values: { plan: tenant?.plan ?? 'Free' },
  })

  if (!tenant) return null

  return (
    <div className="space-y-5">
      {/* Rename */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 dark:text-gray-300">{t('tenant.detail.practiceName')}</h2>
        <form onSubmit={submitName((v) => updateName.mutate(v))} className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              {...regName('name', {
                validate: (v) => v.trim().length > 0 || tc('feedback.required'),
                minLength: { value: 2, message: tc('feedback.minLength', { count: 2 }) },
              })}
              aria-label={t('tenant.detail.practiceName')}
              aria-invalid={!!nameErrors.name}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {nameErrors.name && <p className="mt-1 text-xs text-red-500">{nameErrors.name.message}</p>}
          </div>
          <button
            type="submit"
            disabled={updateName.isPending}
            className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {updateName.isPending ? t('tenant.detail.saving') : tc('button.save')}
          </button>
        </form>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 dark:text-gray-300">{t('tenant.detail.subscriptionPlan')}</h2>
        <form onSubmit={submitPlan((v) => updatePlan.mutate(v))} className="flex gap-3">
          <select
            {...regPlan('plan')}
            aria-label={t('tenant.detail.subscriptionPlan')}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none"
          >
            {PLANS.map((p) => (
              <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={updatePlan.isPending}
            className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {updatePlan.isPending ? t('tenant.detail.updating') : t('tenant.detail.updatePlan')}
          </button>
        </form>
        {tenant.planExpiresAt && (
          <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">
            {t('tenant.detail.expires')} {formatDate(tenant.planExpiresAt)}
          </p>
        )}
      </section>

      {/* Status */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">{t('tenant.detail.accountStatus')}</h2>
        <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
          {t('tenant.detail.deactivateWarning')}
        </p>
        {tenant.isActive ? (
          <button
            onClick={() =>
              confirm.ask({
                title: tc('confirmAction.deactivateTenantTitle', { name: tenant.name }),
                description: tc('confirmAction.deactivateTenantBody'),
                confirmLabel: t('tenant.detail.deactivateButton'),
                cancelLabel: tc('button.cancel'),
                onConfirm: () => deactivate.mutate(),
              })
            }
            disabled={deactivate.isPending}
            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100 disabled:opacity-50 dark:bg-red-400/10 dark:border-red-400/30 dark:hover:bg-red-400/10 dark:text-red-300"
          >
            {deactivate.isPending ? t('tenant.detail.deactivating') : t('tenant.detail.deactivateButton')}
          </button>
        ) : (
          <button
            onClick={() => activate.mutate()}
            disabled={activate.isPending}
            className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-green-100 disabled:opacity-50 dark:bg-green-400/10 dark:border-green-400/30 dark:hover:bg-green-400/10 dark:text-green-300"
          >
            {activate.isPending ? t('tenant.detail.activating') : t('tenant.detail.activateButton')}
          </button>
        )}
      </section>
      {confirm.dialog}
    </div>
  )
}

function UsersTab({ id, tenantName }: { id: string; tenantName: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const [showAdd, setShowAdd] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-users', id],
    queryFn: () => userAdminService.list({ tenantId: id, pageSize: 100 }),
  })

  // A failed change refetches too, so a role <select> snaps back to the real value.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tenant-users', id] })
  const toggleStatus = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userAdminService.updateStatus(userId, isActive),
    onSuccess: refresh,
    onError: (err) => { showError(err); refresh() },
  })

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      userAdminService.changeRole(userId, role),
    onSuccess: refresh,
    onError: (err) => { showError(err); refresh() },
  })

  const resetPwd = useMutation({
    mutationFn: (userId: string) => userAdminService.resetPassword(userId),
    onSuccess: (d) => setResetResult(d.tempPassword),
    onError: showError,
  })
  const confirm = useConfirm()

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowAdd(true)}
          className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700"
        >
          {t('tenant.users.addUser')}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto dark:bg-gray-900 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">{t('tenant.users.table.name')}</th>
              <th className="px-4 py-3 text-left">{t('tenant.users.table.email')}</th>
              <th className="px-4 py-3 text-left">{t('tenant.users.table.role')}</th>
              <th className="px-4 py-3 text-left">{t('tenant.users.table.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">{tc('loading')}</td></tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">{t('tenant.users.emptyState')}</td></tr>
            )}
            {data?.items.map((u: UserAdminResponse) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    key={u.role ?? ''}
                    defaultValue={u.role ?? ''}
                    aria-label={`${t('tenant.users.table.role')}: ${u.fullName}`}
                    onChange={(e) => {
                      const select = e.target
                      const role = select.value
                      confirm.ask({
                        title: tc('confirmAction.changeRoleTitle', { name: u.fullName }),
                        description: tc('confirmAction.changeRoleBody', { from: u.role ? tc(`role.${u.role}`) : '—', to: tc(`role.${role}`) }),
                        confirmLabel: tc('confirmAction.changeRole'),
                        cancelLabel: tc('button.cancel'),
                        onConfirm: () => changeRole.mutate({ userId: u.id, role }),
                      })
                      // Show the current role until the change is confirmed and saved.
                      select.value = u.role ?? ''
                    }}
                    className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {TENANT_ROLES.map((r) => <option key={r} value={r}>{tc(`role.${r}`)}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
                  }`}>
                    {u.isActive ? tc('status.active') : tc('status.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() =>
                        u.isActive
                          ? confirm.ask({
                              title: tc('confirmAction.deactivateUserTitle', { name: u.fullName }),
                              description: tc('confirmAction.deactivateUserBody'),
                              confirmLabel: tc('button.deactivate'),
                              cancelLabel: tc('button.cancel'),
                              onConfirm: () => toggleStatus.mutate({ userId: u.id, isActive: false }),
                            })
                          : toggleStatus.mutate({ userId: u.id, isActive: true })
                      }
                      className={u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-700 hover:text-green-700'}
                    >
                      {u.isActive ? tc('button.deactivate') : tc('button.activate')}
                    </button>
                    <button
                      onClick={() =>
                        confirm.ask({
                          title: tc('confirmAction.resetPasswordTitle', { name: u.fullName }),
                          description: tc('confirmAction.resetPasswordBody'),
                          confirmLabel: tc('confirmAction.resetPassword'),
                          cancelLabel: tc('button.cancel'),
                          onConfirm: () => resetPwd.mutate(u.id),
                        })
                      }
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {t('tenant.users.resetPwdButton')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm.dialog}

      {showAdd && (
        <AddTenantUserModal tenantId={id} tenantName={tenantName} onClose={() => setShowAdd(false)} />
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 mb-3 dark:text-gray-100">{t('tenant.users.resetPwd.title')}</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 dark:bg-amber-400/10 dark:border-amber-400/30">
              <p className="text-xs text-amber-700 font-medium mb-1">{t('tenant.users.resetPwd.label')}</p>
              <TempPasswordBox password={resetResult} />
              <p className="text-xs text-amber-600 mt-1">{t('tenant.users.resetPwd.warning')}</p>
            </div>
            <button onClick={() => setResetResult(null)} className="w-full bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700">{tc('button.done')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TenantDetailPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('details')

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-8 text-gray-500 text-sm dark:text-gray-400">{tc('loading')}</div>
  if (!tenant) return <div className="p-8 text-red-500 text-sm">{t('tenant.notFound')}</div>

  return (
    <div className="p-8 max-w-3xl">
      <Link to="/admin/tenants" className="text-sm text-primary-600 hover:underline mb-4 block dark:text-primary-400">
        {t('tenant.backToTenants')}
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tenant.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          tenant.isActive ? 'bg-green-100 text-green-800 dark:bg-green-400/10 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300'
        }`}>
          {tenant.isActive ? tc('status.active') : tc('status.inactive')}
        </span>
        <span className="text-xs text-gray-500 font-mono dark:text-gray-400">{tenant.slug}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 dark:border-gray-700">
        <TabButton label={t('tenant.tab.details')} active={tab === 'details'} onClick={() => setTab('details')} />
        <TabButton label={t('tenant.tab.users')} active={tab === 'users'} onClick={() => setTab('users')} />
      </div>

      {tab === 'details' && <DetailsTab id={id!} />}
      {tab === 'users' && <UsersTab id={id!} tenantName={tenant.name} />}
    </div>
  )
}


