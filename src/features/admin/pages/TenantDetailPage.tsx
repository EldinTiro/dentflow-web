import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { tenantService } from '../services/tenantService'
import { userAdminService, type UserAdminResponse } from '../services/userAdminService'
import { AddTenantUserModal } from '../components/AddTenantUserModal'

type Tab = 'details' | 'users'

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function DetailsTab({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const { data: tenant } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getById(id),
  })

  const updateName = useMutation({
    mutationFn: ({ name }: { name: string }) => tenantService.update(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant', id] }),
  })
  const updatePlan = useMutation({
    mutationFn: ({ plan }: { plan: string }) => tenantService.updatePlan(id, { plan }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant', id] }),
  })
  const activate = useMutation({
    mutationFn: () => tenantService.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant', id] }),
  })
  const deactivate = useMutation({
    mutationFn: () => tenantService.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant', id] }),
  })

  const { register: regName, handleSubmit: submitName } = useForm<{ name: string }>()
  const { register: regPlan, handleSubmit: submitPlan } = useForm<{ plan: string }>()

  if (!tenant) return null

  return (
    <div className="space-y-5">
      {/* Rename */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Practice Name</h2>
        <form onSubmit={submitName((v) => updateName.mutate(v))} className="flex gap-3">
          <input
            {...regName('name')}
            defaultValue={tenant.name}
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={updateName.isPending}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateName.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Subscription Plan</h2>
        <form onSubmit={submitPlan((v) => updatePlan.mutate(v))} className="flex gap-3">
          <select
            {...regPlan('plan')}
            defaultValue={tenant.plan}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none"
          >
            <option>Free</option>
            <option>Pro</option>
            <option>Enterprise</option>
          </select>
          <button
            type="submit"
            disabled={updatePlan.isPending}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {updatePlan.isPending ? 'Updating…' : 'Update Plan'}
          </button>
        </form>
        {tenant.planExpiresAt && (
          <p className="text-xs text-gray-400 mt-2">
            Expires: {new Date(tenant.planExpiresAt).toLocaleDateString()}
          </p>
        )}
      </section>

      {/* Status */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Account Status</h2>
        <p className="text-xs text-gray-400 mb-3">
          Deactivating suspends access. Data is preserved and the tenant can be re-activated.
        </p>
        {tenant.isActive ? (
          <button
            onClick={() => deactivate.mutate()}
            disabled={deactivate.isPending}
            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100 disabled:opacity-50"
          >
            {deactivate.isPending ? 'Deactivating…' : 'Deactivate Tenant'}
          </button>
        ) : (
          <button
            onClick={() => activate.mutate()}
            disabled={activate.isPending}
            className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-green-100 disabled:opacity-50"
          >
            {activate.isPending ? 'Activating…' : 'Activate Tenant'}
          </button>
        )}
      </section>
    </div>
  )
}

function UsersTab({ id, tenantName }: { id: string; tenantName: string }) {
  const [showAdd, setShowAdd] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-users', id],
    queryFn: () => userAdminService.list({ tenantId: id, pageSize: 100 }),
  })

  const toggleStatus = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userAdminService.updateStatus(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-users', id] }),
  })

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      userAdminService.changeRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-users', id] }),
  })

  const resetPwd = useMutation({
    mutationFn: (userId: string) => userAdminService.resetPassword(userId),
    onSuccess: (d) => setResetResult(d.tempPassword),
  })

  const TENANT_ROLES = ['ClinicOwner', 'ClinicAdmin', 'Dentist', 'Hygienist', 'Receptionist', 'BillingStaff', 'ReadOnly']

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No users for this tenant.</td></tr>
            )}
            {data?.items.map((u: UserAdminResponse) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={u.role ?? ''}
                    onChange={(e) => changeRole.mutate({ userId: u.id, role: e.target.value })}
                    className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {TENANT_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() => toggleStatus.mutate({ userId: u.id, isActive: !u.isActive })}
                      className={u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => resetPwd.mutate(u.id)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Reset pwd
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddTenantUserModal tenantId={id} tenantName={tenantName} onClose={() => setShowAdd(false)} />
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Password Reset</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <p className="text-xs text-amber-700 font-medium mb-1">New temporary password</p>
              <p className="font-mono text-xs bg-white px-2 py-1 rounded border border-amber-200 break-all">{resetResult}</p>
              <p className="text-xs text-amber-600 mt-1">Share this with the user — it won't be shown again.</p>
            </div>
            <button onClick={() => setResetResult(null)} className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('details')

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!tenant) return <div className="p-8 text-red-500 text-sm">Tenant not found.</div>

  return (
    <div className="p-8 max-w-3xl">
      <Link to="/admin/tenants" className="text-sm text-indigo-600 hover:underline mb-4 block">
        ← Back to Tenants
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          tenant.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {tenant.isActive ? 'Active' : 'Inactive'}
        </span>
        <span className="text-xs text-gray-400 font-mono">{tenant.slug}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <TabButton label="Details" active={tab === 'details'} onClick={() => setTab('details')} />
        <TabButton label="Users" active={tab === 'users'} onClick={() => setTab('users')} />
      </div>

      {tab === 'details' && <DetailsTab id={id!} />}
      {tab === 'users' && <UsersTab id={id!} tenantName={tenant.name} />}
    </div>
  )
}


