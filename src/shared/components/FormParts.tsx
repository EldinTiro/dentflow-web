import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { CHIP, CHIP_OFF, CHIP_ON } from './FilterChips'

/**
 * The parts every form drawer is built from, so they look alike (user request 2026-11-13):
 * named groups in light cards, one input style, choices as buttons instead of drop-downs.
 */
export const FIELD_INPUT =
  'h-9 w-full rounded-lg border border-control bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
export const FIELD_TEXTAREA =
  'w-full resize-none rounded-lg border border-control bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
export const FIELD_LABEL = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300'
export const FIELD_ERROR = 'mt-1 text-xs text-red-600 dark:text-red-400'

/** A named group of fields. A fieldset, so it reads as one group to a screen reader too. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {hint && <p className="-mt-2 mb-3 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </fieldset>
  )
}

/** One choice out of a few, as buttons: the look of the list filters. */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** On / off, with what it means underneath. */
export function Switch({ id, label, hint, checked, onChange }: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span>
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-200">{label}</label>
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

/** The calendar's colours, as swatches. */
export const CALENDAR_COLOURS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#14B8A6', '#64748B']

export function ColourSwatches({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const colours = CALENDAR_COLOURS.some((c) => c.toLowerCase() === value.toLowerCase()) ? CALENDAR_COLOURS : [...CALENDAR_COLOURS, value]
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colours.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase()
        return (
          <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => onChange(c)}
            className={`flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition dark:ring-offset-gray-800 ${on ? 'ring-2 ring-gray-900 dark:ring-white' : 'hover:scale-110'}`}
            style={{ backgroundColor: c }}>
            {on && <Check size={14} className="text-white" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

/** The drawer's footer: Cancel, then the main action on the right, always in view. */
export function DrawerActions({ formId, cancelLabel, submitLabel, pending, onCancel }: {
  formId: string
  cancelLabel: string
  submitLabel: string
  pending?: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onCancel}
        className="rounded-lg border border-control px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
        {cancelLabel}
      </button>
      <button type="submit" form={formId} disabled={pending}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
        {submitLabel}
      </button>
    </div>
  )
}
