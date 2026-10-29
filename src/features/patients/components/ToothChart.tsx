import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { treatmentService, ITEM_STATUS_COLORS } from '@/features/treatments/services/treatmentService'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { toothChartService } from '../services/toothChartService'
import {
  CHART_ROWS, CONDITIONS, SURFACES, SURFACE_CONDITIONS, surfaceSide, toothSummary,
  type Side, type Surface, type ToothSummary,
} from '../lib/toothChart'

const SURFACE_FILL: Record<string, string> = {
  Caries: 'fill-red-500 dark:fill-red-400',
  Filling: 'fill-blue-500 dark:fill-blue-400',
}

/** The five zones of a tooth seen from above, in a 40×40 box. */
const ZONE: Record<Side, string> = {
  top: '0,0 40,0 28,12 12,12',
  right: '40,0 40,40 28,28 28,12',
  bottom: '40,40 0,40 12,28 28,28',
  left: '0,40 0,0 12,12 12,28',
  center: '12,12 28,12 28,28 12,28',
}

function ToothGlyph({ tooth, summary }: { tooth: number; summary: ToothSummary }) {
  const crown = summary.whole.includes('Crown')
  return (
    <svg viewBox="-3 -3 46 46" className="h-9 w-9" aria-hidden>
      {SURFACES.map((s) => {
        const state = summary.surfaces[s as Surface]
        return (
          <polygon
            key={s}
            data-surface={s}
            data-state={state}
            points={ZONE[surfaceSide(tooth, s as Surface)]}
            className={`stroke-gray-400 dark:stroke-gray-500 ${state ? SURFACE_FILL[state] : 'fill-white dark:fill-gray-800'}`}
            strokeWidth={1.5}
          />
        )
      })}
      {/* A crown rings the whole tooth */}
      {crown && <rect x={-2} y={-2} width={44} height={44} rx={6} className="fill-none stroke-amber-500" strokeWidth={3} />}
      {summary.missing && (
        <g className="stroke-gray-500 dark:stroke-gray-400" strokeWidth={3}>
          <line x1={2} y1={2} x2={38} y2={38} />
          <line x1={38} y1={2} x2={2} y2={38} />
        </g>
      )}
    </svg>
  )
}

/** The patient's teeth (FDI), what was found on each, and the treatment planned for it. */
export function ToothChart({ patientId, canEdit }: { patientId: string; canEdit: boolean }) {
  const { t } = useTranslation('patients')
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)

  const { data: findings = [] } = useQuery({
    queryKey: ['tooth-chart', patientId],
    queryFn: () => toothChartService.list(patientId),
  })
  const { data: plans } = useQuery({
    // Under 'treatment-plans' so editing a plan refreshes the chart too
    queryKey: ['treatment-plans', patientId, 'tooth-chart'],
    queryFn: () => treatmentService.list(patientId, { pageSize: 50 }),
  })
  const items = (plans?.items ?? []).flatMap((p) => p.items ?? [])
  const conditionLabel = (c: string) => t(`teeth.condition.${c}`, { defaultValue: c })

  const renderRow = (row: readonly number[], label: string) => (
    <div role="group" aria-label={label} className="flex gap-0.5 sm:gap-1">
      {row.map((n, i) => {
        const s = toothSummary(n, findings, items)
        return (
          <button
            key={n}
            type="button"
            aria-label={t('teeth.tooth', { n })}
            aria-pressed={selected === n}
            data-conditions={s.whole.join(' ') || undefined}
            data-missing={s.missing || undefined}
            data-plan={s.plan ?? undefined}
            onClick={() => setSelected(n)}
            className={`relative flex flex-col items-center rounded-lg px-0.5 pb-1 pt-0.5 transition-colors ${
              i === 8 ? 'ml-2 sm:ml-4' : ''
            } ${selected === n ? 'bg-primary-50 ring-2 ring-primary-500 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} ${s.missing ? 'opacity-50' : ''}`}
          >
            <span className="text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{n}</span>
            <ToothGlyph tooth={n} summary={s} />
            <span className="mt-0.5 flex h-2 items-center gap-0.5">
              {s.whole.includes('RootCanal') && <span className="h-2 w-2 rounded-full bg-purple-500" title={conditionLabel('RootCanal')} />}
              {s.whole.includes('Implant') && <span className="h-2 w-2 rounded-sm bg-gray-500" title={conditionLabel('Implant')} />}
              {s.plan && <span className={`h-2 w-2 rounded-full ${s.plan === 'planned' ? 'bg-sky-500' : 'bg-green-500'}`} />}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    // The chart takes the width it needs; the tooth panel sits beside it when there is room
    <div className="grid items-start gap-4 xl:grid-cols-[auto_minmax(16rem,1fr)]">
      <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* w-max + mx-auto: centred when it fits, scrollable from tooth 18 when it does not */}
        <div className="overflow-x-auto">
        <div className="mx-auto w-max space-y-3">
          {renderRow(CHART_ROWS.upper, t('teeth.upperJaw'))}
          <div className="mx-auto h-px w-full bg-gray-200 dark:bg-gray-700" />
          {renderRow(CHART_ROWS.lower, t('teeth.lowerJaw'))}
        </div>
        </div>
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" />{conditionLabel('Caries')}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500" />{conditionLabel('Filling')}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-2 border-amber-500" />{conditionLabel('Crown')}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" />{conditionLabel('RootCanal')}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-500" />{conditionLabel('Implant')}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />{t('teeth.legend.planned')}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{t('teeth.legend.done')}</span>
        </div>
      </div>

      {selected === null ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">{t('teeth.pickTooth')}</p>
      ) : (
        <ToothPanel
          key={selected}
          tooth={selected}
          summary={toothSummary(selected, findings, items)}
          work={items.filter((i) => i.toothNumber === selected)}
          canEdit={canEdit}
          conditionLabel={conditionLabel}
          itemStatusLabel={(s) => t(`treatmentPlans.itemStatus.${s}`, { defaultValue: s })}
          onAdd={async (body) => {
            await toothChartService.add(patientId, { tooth: selected, ...body })
            await qc.invalidateQueries({ queryKey: ['tooth-chart', patientId] })
          }}
          onRemove={async (id) => {
            await toothChartService.remove(patientId, id)
            await qc.invalidateQueries({ queryKey: ['tooth-chart', patientId] })
          }}
        />
      )}
    </div>
  )
}

function ToothPanel({ tooth, summary, work, canEdit, conditionLabel, itemStatusLabel, onAdd, onRemove }: {
  tooth: number
  summary: ToothSummary
  work: { id: string; description: string; status: string }[]
  canEdit: boolean
  conditionLabel: (c: string) => string
  itemStatusLabel: (s: string) => string
  onAdd: (body: { condition: string; surfaces: string | null; notes: string | null }) => Promise<void>
  onRemove: (findingId: string) => Promise<void>
}) {
  const { t } = useTranslation('patients')
  const [condition, setCondition] = useState<string>('Caries')
  const [surfaces, setSurfaces] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const withSurfaces = SURFACE_CONDITIONS.includes(condition)

  const add = useMutation({
    mutationFn: () => onAdd({
      condition,
      surfaces: withSurfaces && surfaces.length > 0 ? SURFACES.filter((s) => surfaces.includes(s)).join('') : null,
      notes: notes.trim() || null,
    }),
    onSuccess: () => { setSurfaces([]); setNotes('') },
    onError: (err) => toast.error(getApiErrorMessage(err, t('teeth.saveFailed'))),
  })
  const remove = useMutation({
    mutationFn: onRemove,
    onError: (err) => toast.error(getApiErrorMessage(err, t('teeth.saveFailed'))),
  })

  return (
    <section aria-label={t('teeth.tooth', { n: tooth })} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('teeth.tooth', { n: tooth })}</h3>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('teeth.findings')}</p>
        {summary.findings.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('teeth.noFindings')}</p>
        ) : (
          <ul className="space-y-1">
            {summary.findings.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <span>{conditionLabel(f.condition)}</span>
                {f.surfaces && <span className="rounded bg-gray-100 px-1.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{f.surfaces}</span>}
                {f.notes && <span className="truncate text-xs text-gray-500 dark:text-gray-400">{f.notes}</span>}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t('teeth.remove', { condition: conditionLabel(f.condition) })}
                    onClick={() => remove.mutate(f.id)}
                    className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {work.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('teeth.treatment')}</p>
          <ul className="space-y-1">
            {work.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-100">
                <span className="truncate">{i.description}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ITEM_STATUS_COLORS[i.status as keyof typeof ITEM_STATUS_COLORS] ?? ''}`}>
                  {itemStatusLabel(i.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && (
        <form
          className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-700"
          onSubmit={(e) => { e.preventDefault(); add.mutate() }}
        >
          <div>
            <label htmlFor={`finding-${tooth}`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{t('teeth.finding')}</label>
            <select
              id={`finding-${tooth}`}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabel(c)}</option>)}
            </select>
          </div>
          {withSurfaces && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">{t('teeth.surfaces')}</p>
              <div className="flex gap-1">
                {SURFACES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={surfaces.includes(s)}
                    title={t(`teeth.surface.${s}`)}
                    onClick={() => setSurfaces((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
                    className={`h-8 w-8 rounded-md border text-sm font-semibold ${
                      surfaces.includes(s)
                        ? 'border-primary-500 bg-primary-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('teeth.notesPlaceholder')}
            aria-label={t('teeth.notes')}
            maxLength={500}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {t('teeth.add')}
          </button>
        </form>
      )}
    </section>
  )
}
