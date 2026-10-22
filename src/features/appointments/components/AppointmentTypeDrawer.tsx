import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Drawer } from '@/shared/components/Drawer'
import { appointmentService, type AppointmentTypeResponse } from '../services/appointmentService'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import i18n from 'i18next'

const schema = z.object({
  name: z.string().min(1, 'common:validation.nameRequired').max(255),
  defaultDurationMinutes: z.coerce.number().int().min(1).max(480),
  description: z.string().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'common:validation.hexColour')
    .optional()
    .or(z.literal('')),
  isBookableOnline: z.boolean(),
  defaultFee: z.coerce.number().min(0).optional().nullable(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  type?: AppointmentTypeResponse
  onClose: () => void
}

export function AppointmentTypeDrawer({ type, onClose }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!type

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: type?.name ?? '',
      defaultDurationMinutes: type?.defaultDurationMinutes ?? 30,
      description: type?.description ?? '',
      colorHex: type?.colorHex ?? '#6B7280',
      isBookableOnline: type?.isBookableOnline ?? false,
      defaultFee: type?.defaultFee ?? null,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? appointmentService.updateType(type!.id, {
            name: data.name,
            defaultDurationMinutes: data.defaultDurationMinutes,
            description: data.description || undefined,
            colorHex: data.colorHex || undefined,
            isBookableOnline: data.isBookableOnline,
            defaultFee: data.defaultFee ?? null,
          })
        : appointmentService.createType({
            name: data.name,
            defaultDurationMinutes: data.defaultDurationMinutes,
            description: data.description || undefined,
            colorHex: data.colorHex || undefined,
            isBookableOnline: data.isBookableOnline,
            defaultFee: data.defaultFee ?? null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] })
      toast.success(isEdit ? 'Appointment type updated.' : 'Appointment type created.')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to save appointment type.'))
    },
  })

  return (
    <Drawer title={isEdit ? `Edit — ${type!.name}` : 'New Appointment Type'} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 p-6">
        <div>
          <label htmlFor="appt-type-name" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Name <span className="text-red-500">*</span>
          </label>
          <input id="appt-type-name"
            type="text"
            {...register('name')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{i18n.t(errors.name.message ?? '')}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="appt-type-defaultDurationMinutes" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input id="appt-type-defaultDurationMinutes"
              type="number"
              min={1}
              max={480}
              {...register('defaultDurationMinutes')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {errors.defaultDurationMinutes && (
              <p className="mt-1 text-xs text-red-600">{i18n.t(errors.defaultDurationMinutes.message ?? '')}</p>
            )}
          </div>
          <div>
            <label htmlFor="appt-type-defaultFee" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Default Fee (KM)</label>
            <input id="appt-type-defaultFee"
              type="number"
              min={0}
              step="0.01"
              {...register('defaultFee')}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="appt-type-description" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Description</label>
          <textarea id="appt-type-description"
            {...register('description')}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label htmlFor="appt-type-colorHex" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Calendar Colour</label>
          <input id="appt-type-colorHex"
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer dark:border-gray-600"
          />
          {errors.colorHex && <p className="mt-1 text-xs text-red-600">{i18n.t(errors.colorHex.message ?? '')}</p>}
        </div>

        {/* "Bookable online" stays hidden until a patient portal exists (ROADMAP Tier 3, QA-031).
            The stored value is still sent back unchanged. */}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
