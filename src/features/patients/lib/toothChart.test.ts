import { describe, it, expect } from 'vitest'
import { CHART_ROWS, surfaceSide, isFdiTooth, toothSummary } from './toothChart'

describe('tooth chart layout (FDI, seen from the dentist facing the patient)', () => {
  it("puts the patient's right on the left: 18…11 21…28 above, 48…41 31…38 below", () => {
    expect(CHART_ROWS.upper).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28])
    expect(CHART_ROWS.lower).toEqual([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38])
  })

  // Mesial faces the midline; buccal faces outwards (up on the upper arch, down on the lower)
  it.each([
    [16, 'M', 'right'], [16, 'D', 'left'], [26, 'M', 'left'], [26, 'D', 'right'],
    [46, 'M', 'right'], [36, 'M', 'left'],
    [16, 'B', 'top'], [16, 'L', 'bottom'], [36, 'B', 'bottom'], [36, 'L', 'top'],
    [36, 'O', 'center'],
  ] as const)('draws surface %s of tooth %i on the %s', (tooth, surface, side) => {
    expect(surfaceSide(tooth, surface)).toBe(side)
  })

  it.each([[11, true], [48, true], [9, false], [19, false], [51, false]])('knows FDI tooth %i: %s', (n, ok) => {
    expect(isFdiTooth(n)).toBe(ok)
  })
})

describe('toothSummary', () => {
  const f = (tooth: number, condition: string, surfaces: string | null = null) =>
    ({ id: `${tooth}-${condition}`, tooth, condition, surfaces, notes: null, recordedAt: '2026-10-29T08:00:00Z' })

  it('collects the conditions of one tooth and colours each surface', () => {
    const s = toothSummary(36, [f(36, 'Filling', 'MO'), f(36, 'Caries', 'D'), f(36, 'RootCanal'), f(11, 'Crown')], [])

    expect(s.surfaces).toEqual({ M: 'Filling', O: 'Filling', D: 'Caries' })
    expect(s.whole).toEqual(['RootCanal'])
    expect(s.missing).toBe(false)
  })

  // Fresh caries next to an old filling on the same surface is what the dentist needs to see
  it('lets caries win over a filling on the same surface', () => {
    expect(toothSummary(36, [f(36, 'Filling', 'O'), f(36, 'Caries', 'O')], []).surfaces).toEqual({ O: 'Caries' })
  })

  it('marks a missing tooth, unless an implant replaced it', () => {
    expect(toothSummary(46, [f(46, 'Missing')], []).missing).toBe(true)
    expect(toothSummary(46, [f(46, 'Missing'), f(46, 'Implant')], []).missing).toBe(false)
  })

  it('reports planned and finished treatment on the tooth, ignoring declined items', () => {
    const item = (toothNumber: number, status: string) => ({ toothNumber, status }) as never
    expect(toothSummary(46, [], [item(46, 'Planned'), item(46, 'Declined'), item(36, 'Completed')]).plan).toBe('planned')
    expect(toothSummary(36, [], [item(36, 'Completed')]).plan).toBe('done')
    expect(toothSummary(11, [], [item(11, 'Declined')]).plan).toBeNull()
  })
})
