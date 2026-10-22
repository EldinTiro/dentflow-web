import '@fontsource/sora/latin-600.css'
import { cn } from '@/shared/lib/utils'

const BRAND = 'DentFlow'

/**
 * DentFlow wordmark: Sora 600, wide-tracked capitals with a brand-colored
 * separator dot — "DENT·FLOW". The letters and dot are presentational; the
 * accessible name is always the plain brand name.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span role="img" aria-label={BRAND} className={cn('font-brand inline-block uppercase', className)}>
      {/* Negative right margin cancels the trailing letter-spacing so the mark stays optically centred. */}
      <span aria-hidden="true" className="-mr-[0.28em] tracking-[0.28em]">
        Dent<span className="text-primary-600 dark:text-primary-400">·</span>Flow
      </span>
    </span>
  )
}
