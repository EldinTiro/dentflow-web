import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

/** The mobile number, shared by adding and editing a patient so both store one format. */

/**
 * The dial code is picked separately, so this is the local part: digits (spaces,
 * dashes, brackets allowed), 6–12 of them after a leading trunk 0 (QA-019).
 */
export function isPlausibleLocalNumber(value: string): boolean {
  if (!value) return true
  if (!/^[\d\s\-()]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '').replace(/^0/, '')
  return digits.length >= 6 && digits.length <= 12
}

function countryFlag(code: string): string {
  if (code === 'XK') return '🏳'
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.codePointAt(0)! + 127397)).join('')
}

export const COUNTRY_CODES = [
  { code: 'BA', dial: '+387', label: 'Bosnia and Herzegovina' },
  { code: 'US', dial: '+1',   label: 'United States' },
  { code: 'GB', dial: '+44',  label: 'United Kingdom' },
  { code: 'DE', dial: '+49',  label: 'Germany' },
  { code: 'FR', dial: '+33',  label: 'France' },
  { code: 'IT', dial: '+39',  label: 'Italy' },
  { code: 'ES', dial: '+34',  label: 'Spain' },
  { code: 'AT', dial: '+43',  label: 'Austria' },
  { code: 'CH', dial: '+41',  label: 'Switzerland' },
  { code: 'NL', dial: '+31',  label: 'Netherlands' },
  { code: 'BE', dial: '+32',  label: 'Belgium' },
  { code: 'SE', dial: '+46',  label: 'Sweden' },
  { code: 'NO', dial: '+47',  label: 'Norway' },
  { code: 'DK', dial: '+45',  label: 'Denmark' },
  { code: 'FI', dial: '+358', label: 'Finland' },
  { code: 'PL', dial: '+48',  label: 'Poland' },
  { code: 'CZ', dial: '+420', label: 'Czech Republic' },
  { code: 'SK', dial: '+421', label: 'Slovakia' },
  { code: 'HU', dial: '+36',  label: 'Hungary' },
  { code: 'RO', dial: '+40',  label: 'Romania' },
  { code: 'BG', dial: '+359', label: 'Bulgaria' },
  { code: 'HR', dial: '+385', label: 'Croatia' },
  { code: 'RS', dial: '+381', label: 'Serbia' },
  { code: 'ME', dial: '+382', label: 'Montenegro' },
  { code: 'MK', dial: '+389', label: 'North Macedonia' },
  { code: 'SI', dial: '+386', label: 'Slovenia' },
  { code: 'AL', dial: '+355', label: 'Albania' },
  { code: 'XK', dial: '+383', label: 'Kosovo' },
  { code: 'TR', dial: '+90',  label: 'Turkey' },
  { code: 'GR', dial: '+30',  label: 'Greece' },
  { code: 'PT', dial: '+351', label: 'Portugal' },
  { code: 'IE', dial: '+353', label: 'Ireland' },
  { code: 'CA', dial: '+1',   label: 'Canada' },
  { code: 'AU', dial: '+61',  label: 'Australia' },
  { code: 'NZ', dial: '+64',  label: 'New Zealand' },
  { code: 'AE', dial: '+971', label: 'UAE' },
  { code: 'SA', dial: '+966', label: 'Saudi Arabia' },
]

interface DialPickerProps {
  value: string
  onChange: (dial: string) => void
}

export function DialPicker({ value, onChange }: DialPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = COUNTRY_CODES.find(c => c.dial === value && c.code === 'BA') ??
    COUNTRY_CODES.find(c => c.dial === value) ??
    COUNTRY_CODES[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-full border border-control rounded-md px-2.5 py-1.5 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 whitespace-nowrap dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
      >
        <span className="text-base leading-none">{countryFlag(selected.code)}</span>
        <span className="text-gray-700 dark:text-gray-300">{selected.dial}</span>
        <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-64 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-900 dark:border-gray-700">
          {COUNTRY_CODES.map(c => (
            <button
              key={`${c.code}-${c.dial}`}
              type="button"
              onClick={() => { onChange(c.dial); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800${
                c.dial === value && c.code === selected.code ? 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-base leading-none w-6 shrink-0">{countryFlag(c.code)}</span>
              <span className="font-medium w-12 shrink-0">{c.dial}</span>
              <span className="truncate text-gray-500 dark:text-gray-400">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One format: dial code, a space, then the number as typed without the trunk 0 (QA-047, DT-36). */
export function joinPhone(dial: string, local: string): string | null {
  const number = local.trim().replace(/^0/, '')
  return number ? `${dial} ${number}` : null
}

/** A stored number back into the picker's dial code and the local part ("+387 61123456", "+38561…"). */
export function splitPhone(stored: string | null, fallbackDial = '+387'): { dial: string; local: string } {
  const value = (stored ?? '').trim()
  if (!value.startsWith('+')) return { dial: fallbackDial, local: value }
  const dials = [...new Set(COUNTRY_CODES.map(c => c.dial))].sort((a, b) => b.length - a.length)
  const dial = dials.find(d => value.startsWith(d))
  return dial ? { dial, local: value.slice(dial.length).trim() } : { dial: fallbackDial, local: value }
}
