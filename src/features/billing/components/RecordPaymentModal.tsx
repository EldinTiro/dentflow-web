import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { billingService, type PaymentMethod } from '../services/billingService'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { todayLocal, localDateToInstant } from '@/shared/lib/dates'

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'Insurance', 'BankTransfer', 'Other']

interface FormValues {
  amount: number
  method: PaymentMethod
  paidAt: string
  reference: string
  notes: string
}

interface Props {
  invoiceId: string
  balanceDue: number
  onClose: () => void
}

const INPUT_CLASS =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
const LABEL_CLASS = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

export function RecordPaymentModal({ invoiceId, balanceDue, onClose }: Props) {
  const { t } = useTranslation('billing')
  const tc = useTranslation('common').t
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      amount: balanceDue,
      method: 'Cash',
      paidAt: todayLocal(),
      reference: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      billingService.recordPayment(invoiceId, {
        amount: Number(values.amount),
        method: values.method,
        paidAt: localDateToInstant(values.paidAt),
        reference: values.reference || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] })
      toast.success(t('toast.paymentRecorded'))
      onClose()
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('recordPayment.title')}
        </h2>
        <form noValidate onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="payment-amount" className={LABEL_CLASS}>{t('recordPayment.amount')}</label>
              <input id="payment-amount"
                type="number"
                min={0.01}
                step="0.01"
                {...register('amount', { required: true, min: 0.01 })}
                className={INPUT_CLASS}
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div>
              <label htmlFor="payment-paidAt" className={LABEL_CLASS}>{t('recordPayment.paidAt')}</label>
              <input id="payment-paidAt"
                type="date"
                max={todayLocal()}
                {...register('paidAt', { required: true })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="payment-method" className={LABEL_CLASS}>{t('recordPayment.method')}</label>
            <select id="payment-method" {...register('method')} className={INPUT_CLASS}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`paymentMethod.${m}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payment-reference" className={LABEL_CLASS}>{t('recordPayment.reference')}</label>
            <input id="payment-reference" {...register('reference')} className={INPUT_CLASS} />
          </div>

          <div>
            <label htmlFor="payment-notes" className={LABEL_CLASS}>{t('recordPayment.notes')}</label>
            <textarea id="payment-notes" {...register('notes')} rows={2} className={INPUT_CLASS} />
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
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {mutation.isPending ? '…' : t('button.recordPayment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
