import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { billingService, type InvoiceLineItemResponse } from '../services/billingService'
import { getApiErrorMessage } from '@/shared/utils/apiError'

interface FormValues {
  description: string
  cdtCode: string
  toothNumber: string
  quantity: number
  unitFee: number
}

interface Props {
  invoiceId: string
  item?: InvoiceLineItemResponse
  onClose: () => void
}

const INPUT_CLASS =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL_CLASS = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

export function AddLineItemModal({ invoiceId, item, onClose }: Props) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const queryClient = useQueryClient()
  const isEdit = !!item

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      description: '',
      cdtCode: '',
      toothNumber: '',
      quantity: 1,
      unitFee: 0,
    },
  })

  useEffect(() => {
    if (item) {
      reset({
        description: item.description,
        cdtCode: item.cdtCode ?? '',
        toothNumber: item.toothNumber?.toString() ?? '',
        quantity: item.quantity,
        unitFee: item.unitFee,
      })
    }
  }, [item, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body = {
        description: values.description,
        cdtCode: values.cdtCode || null,
        toothNumber: values.toothNumber ? Number(values.toothNumber) : null,
        quantity: Number(values.quantity),
        unitFee: Number(values.unitFee),
      }
      return isEdit
        ? billingService.updateLineItem(invoiceId, item!.id, body)
        : billingService.addLineItem(invoiceId, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {isEdit ? t('addLineItem.titleEdit') : t('addLineItem.titleAdd')}
        </h2>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>{t('addLineItem.description')}</label>
            <input
              {...register('description', { required: true })}
              className={INPUT_CLASS}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">Required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>{t('addLineItem.quantity')}</label>
              <input
                type="number"
                min={1}
                {...register('quantity', { required: true, min: 1 })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t('addLineItem.unitFee')}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register('unitFee', { required: true, min: 0 })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>{t('addLineItem.cdtCode')}</label>
              <input
                {...register('cdtCode')}
                className={INPUT_CLASS}
                placeholder="D0120"
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t('addLineItem.toothNumber')}</label>
              <input
                type="number"
                min={1}
                max={32}
                {...register('toothNumber')}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {tc('button.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {mutation.isPending ? '…' : tc('button.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
