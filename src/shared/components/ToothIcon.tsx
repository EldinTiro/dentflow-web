import type { SVGProps } from 'react'

interface ToothIconProps extends Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> {
  size?: number
  strokeWidth?: number
}

/**
 * DentFlow brand mark — a molar outline drawn on lucide's 24×24 grid with round
 * caps and joins, so it sits naturally next to lucide-react icons (which has no
 * tooth glyph). Decorative by default; pass `aria-label` + `role="img"` to expose it.
 */
export function ToothIcon({ size = 24, strokeWidth = 2, className, ...props }: ToothIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      className={className}
      {...props}
    >
      {/* Crown and two roots */}
      <path d="M7.5 3C5 3 3.5 4.9 3.5 7.6c0 2 .6 3.5 1.3 5.1.7 1.6 1 3.3 1.3 5.2.3 2.1.9 3.1 2 3.1 1.3 0 1.7-1.3 2-3.1.3-1.7.8-3 1.9-3s1.6 1.3 1.9 3c.3 1.8.7 3.1 2 3.1 1.1 0 1.7-1 2-3.1.3-1.9.6-3.6 1.3-5.2.7-1.6 1.3-3.1 1.3-5.1C20.5 4.9 19 3 16.5 3c-1.7 0-2.8.9-4.5.9S9.2 3 7.5 3Z" />
      {/* Enamel highlight */}
      <path d="M7 7c.4-1 1.2-1.5 2.2-1.4" />
    </svg>
  )
}
