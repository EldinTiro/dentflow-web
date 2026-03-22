import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Drawer } from '@/shared/components/Drawer'
import { appointmentService, type AppointmentTypeResponse } from '../services/appointmentService'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  defaultDurationMinutes: z.coerce.number().int().min(1).max(480),
  description: z.string().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex colour')
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
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={480}
              {...register('defaultDurationMinutes')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.defaultDurationMinutes && (
              <p className="mt-1 text-xs text-red-600">{errors.defaultDurationMinutes.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Fee (KM)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              {...register('defaultFee')}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calendar Colour</label>
          <input
            type="color"
            {...register('colorHex')}
            className="h-9 w-20 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer"
          />
          {errors.colorHex && <p className="mt-1 text-xs text-red-600">{errors.colorHex.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="isBookableOnline" {...register('isBookableOnline')} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="isBookableOnline" className="text-sm text-gray-700">
            Bookable online (patient-facing portal)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
