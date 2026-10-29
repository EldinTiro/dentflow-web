import type { TreatmentPlanItemResponse } from '@/features/treatments/services/treatmentService'
import type { ToothFinding } from '../services/toothChartService'

/** FDI (ISO 3950): quadrant 1–4, then tooth 1–8 from the midline. Same rule as the API's Fdi. */
export function isFdiTooth(n: number): boolean {
  const q = Math.floor(n / 10), t = n % 10
  return q >= 1 && q <= 4 && t >= 1 && t <= 8
}

/** Seen from the dentist facing the patient: the patient's right is on the left. */
export const CHART_ROWS = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
} as const

export const SURFACES = ['M', 'O', 'D', 'B', 'L'] as const
export type Surface = (typeof SURFACES)[number]
export type Side = 'top' | 'bottom' | 'left' | 'right' | 'center'

export const CONDITIONS = ['Caries', 'Filling', 'Crown', 'RootCanal', 'Implant', 'Missing'] as const
export type Condition = (typeof CONDITIONS)[number]
export const SURFACE_CONDITIONS: readonly string[] = ['Caries', 'Filling']

/** Where a surface is drawn: mesial faces the midline, buccal faces outwards. */
export function surfaceSide(tooth: number, surface: Surface): Side {
  const quadrant = Math.floor(tooth / 10)
  const upper = quadrant === 1 || quadrant === 2
  const drawnLeft = quadrant === 1 || quadrant === 4 // the patient's right
  switch (surface) {
    case 'O': return 'center'
    case 'M': return drawnLeft ? 'right' : 'left'
    case 'D': return drawnLeft ? 'left' : 'right'
    case 'B': return upper ? 'top' : 'bottom'
    case 'L': return upper ? 'bottom' : 'top'
  }
}

export interface ToothSummary {
  /** What colours each surface; caries wins over a filling on the same surface. */
  surfaces: Partial<Record<Surface, 'Caries' | 'Filling'>>
  /** Whole-tooth conditions: crown, root canal, implant (missing is its own flag). */
  whole: string[]
  missing: boolean
  /** Treatment on this tooth: something still to do, or only finished work. */
  plan: 'planned' | 'done' | null
  findings: ToothFinding[]
}

export function toothSummary(tooth: number, findings: ToothFinding[], items: TreatmentPlanItemResponse[]): ToothSummary {
  const mine = findings.filter((f) => f.tooth === tooth)
  const surfaces: ToothSummary['surfaces'] = {}
  for (const f of mine) {
    if (f.condition !== 'Caries' && f.condition !== 'Filling') continue
    for (const s of (f.surfaces ?? '').split('') as Surface[]) {
      if (surfaces[s] !== 'Caries') surfaces[s] = f.condition
    }
  }
  const has = (c: string) => mine.some((f) => f.condition === c)
  const whole = ['Crown', 'RootCanal', 'Implant'].filter(has)
  const work = items.filter((i) => i.toothNumber === tooth && i.status !== 'Declined')
  const plan = work.some((i) => i.status !== 'Completed') ? 'planned' : work.length > 0 ? 'done' : null
  return { surfaces, whole, missing: has('Missing') && !has('Implant'), plan, findings: mine }
}
