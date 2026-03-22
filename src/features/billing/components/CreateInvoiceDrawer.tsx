import { useEffect } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { billingService } from '../services/billingService'
import { appointmentService } from '@/features/appointments/services/appointmentService'
import { Drawer } from '@/shared/components/Drawer'
import { getApiErrorMessage } from '@/shared/utils/apiError'

interface LineItemField {
  source: 'preset' | 'other'
  appointmentTypeId: string
  description: string
  unitFee: number
}

interface FormValues {
  patientId: string
  notes: string
  lineItems: LineItemField[]
}

interface Props {
  patientId?: string
  appointmentTypeId?: string
  onClose: () => void
}

const INPUT_CLASS =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL_CLASS = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CreateInvoiceDrawer({ patientId, appointmentTypeId, onClose }: Props) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: apptTypes = [] } = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => appointmentService.listTypes(),
  })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      patientId: patientId ?? '',
      notes: '',
      lineItems: [{ source: 'preset', appointmentTypeId: '', description: '', unitFee: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const lineItems = useWatch({ control, name: 'lineItems' })

  // Pre-fill first line item from appointment type
  useEffect(() => {
    if (appointmentTypeId && apptTypes.length > 0) {
      const found = apptTypes.find((t) => t.id === appointmentTypeId)
      if (found) {
        setValue('lineItems.0.description', found.name)
        setValue('lineItems.0.unitFee', found.defaultFee ?? 0)
      }
    }
  }, [appointmentTypeId, apptTypes, setValue])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const pid = patientId ?? values.patientId.trim()
      return billingService.create(pid, {
        dueDate: null,
        notes: values.notes || null,
        lineItems: values.lineItems.map((li) => ({
          description: li.description,
          cdtCode: null,
          toothNumber: null,
          quantity: 1,
          unitFee: Number(li.unitFee),
        })),
      })
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] })
      onClose()
      navigate(`/invoices/${invoice.id}`)
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  const subTotal = lineItems.reduce((sum, li) => sum + (Number(li.unitFee) || 0), 0)

  return (
    <Drawer title={t('create.title')} onClose={onClose} width="w-[520px]">
      <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
        {!patientId && (
          <div>
            <label className={LABEL_CLASS}>{t('create.patientId')}</label>
            <input
              {...register('patientId', { required: true })}
              className={INPUT_CLASS}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            {errors.patientId && (
              <p className="text-xs text-red-500 mt-1">Required</p>
            )}
          </div>
        )}

        <div>
          <label className={LABEL_CLASS}>{t('create.notes')}</label>
          <textarea {...register('notes')} rows={2} className={INPUT_CLASS} />
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('create.lineItems')}
            </span>
            <button
              type="button"
              onClick={() =>
                append({ source: 'other', appointmentTypeId: '', description: '', unitFee: 0 })
              }
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('create.addItem')}
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    {/* First item: plain description. Additional items: type selector or free text */}
                    {idx === 0 ? (
                      <div>
                        <label className={LABEL_CLASS}>{t('addLineItem.description')}</label>
                        <input
                          {...register(`lineItems.${idx}.description`, { required: true })}
                          className={INPUT_CLASS}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className={LABEL_CLASS}>{t('addLineItem.description')}</label>
                        <select
                          className={INPUT_CLASS}
                          value={lineItems[idx]?.appointmentTypeId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '__other__') {
                              setValue(`lineItems.${idx}.source`, 'other')
                              setValue(`lineItems.${idx}.appointmentTypeId`, '')
                              setValue(`lineItems.${idx}.description`, '')
                              setValue(`lineItems.${idx}.unitFee`, 0)
                            } else {
                              const found = apptTypes.find((t) => t.id === val)
                              setValue(`lineItems.${idx}.source`, 'preset')
                              setValue(`lineItems.${idx}.appointmentTypeId`, val)
                              setValue(`lineItems.${idx}.description`, found?.name ?? '')
                              setValue(`lineItems.${idx}.unitFee`, found?.defaultFee ?? 0)
                            }
                          }}
                        >
                          <option value="">— Select service —</option>
                          {apptTypes.map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.name}{tp.defaultFee != null ? ` — ${Number(tp.defaultFee).toFixed(2)} KM` : ''}
                            </option>
                          ))}
                          <option value="__other__">Other (custom)</option>
                        </select>
                        {(lineItems[idx]?.source === 'other' || lineItems[idx]?.appointmentTypeId === '') && (
                          <input
                            {...register(`lineItems.${idx}.description`, { required: true })}
                            className={`${INPUT_CLASS} mt-2`}
                            placeholder="Custom description"
                          />
                        )}
                      </div>
                    )}

                    <div>
                      <label className={LABEL_CLASS}>{t('lineItem.unitFee')} (KM)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        {...register(`lineItems.${idx}.unitFee`, { required: true, min: 0 })}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    disabled={fields.length === 1}
                    className="mt-5 text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end text-sm font-semibold text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 pt-3">
          {t('create.subTotal')}: {fmt(subTotal)}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {tc('button.cancel')}
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {createMutation.isPending ? '…' : tc('button.save')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
