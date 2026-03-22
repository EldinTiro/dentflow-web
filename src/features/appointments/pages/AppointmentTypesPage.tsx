import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { appointmentService, type AppointmentTypeResponse } from '../services/appointmentService'
import { AppointmentTypeDrawer } from '../components/AppointmentTypeDrawer'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { getApiErrorMessage } from '@/shared/utils/apiError'

export function AppointmentTypesPage() {
  const { t } = useTranslation('appointments')
  const { t: tc } = useTranslation('common')
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AppointmentTypeResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canManage = useAuthStore((s) =>
    s.user?.roles?.some((r) => ['ClinicOwner', 'ClinicAdmin', 'SuperAdmin'].includes(r)) ?? false
  )

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentService.deleteType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] })
      toast.success(t('types.toast.removed'))
      setDeletingId(null)
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, t('types.toast.removeFailed')))
      setDeletingId(null)
    },
  })

  const deletingType = types.find((tp) => tp.id === deletingId)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('types.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('types.subtitle')}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={16} />
            {t('types.button.newType')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-10 text-center">{tc('loading')}</div>
      ) : types.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-sm text-gray-400">{t('types.emptyState')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('types.table.name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('types.table.duration')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('types.table.defaultFee')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('types.table.colour')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('types.table.online')}</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {types.map((tp) => (
                <tr key={tp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{tp.name}</p>
                    {tp.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">{tp.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{tp.defaultDurationMinutes} {tc('unit.min')}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{tp.defaultFee != null ? `${Number(tp.defaultFee).toFixed(2)} KM` : '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tp.colorHex ?? '#6B7280' }}
                    >
                      {tp.colorHex ?? '#6B7280'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        tp.isBookableOnline
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tp.isBookableOnline ? tc('boolean.yes') : tc('boolean.no')}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(tp)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                          title={t('types.editTooltip')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(tp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title={t('types.deleteTooltip')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <AppointmentTypeDrawer onClose={() => setShowCreate(false)} />}
      {editing && <AppointmentTypeDrawer type={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!deletingId}
        title={t('types.confirm.removeTitle')}
        description={
          deletingType ? (
            <>
              {t('types.confirm.removeDescription', { name: deletingType.name })}
            </>
          ) : (
            t('types.confirm.removeGeneric')
          )
        }
        confirmLabel={t('types.confirm.removeButton')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingId!)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}
