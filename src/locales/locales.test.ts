import { describe, it, expect } from 'vitest'

// QA-020: missing translations showed raw keys (field.email) or fell back to another language.
const files = import.meta.glob('./*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

// i18next plural suffixes differ per language (bs has _few); compare the base key.
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '')

const namespaces = [...new Set(Object.keys(files).map((p) => p.split('/')[2]))]

describe('locales', () => {
  it.each(namespaces)('%s has the same keys in en, bs and de', (ns) => {
    const en = new Set(keys(files[`./en/${ns}`]).map(base))
    for (const lang of ['bs', 'de']) {
      const other = new Set(keys(files[`./${lang}/${ns}`]).map(base))
      expect({ lang, missing: [...en].filter((k) => !other.has(k)) }).toEqual({ lang, missing: [] })
      expect({ lang, extra: [...other].filter((k) => !en.has(k)) }).toEqual({ lang, extra: [] })
    }
  })
})
