interface StatusBadgeProps {
  status: string
  colorMap: Record<string, string>
  labelMap?: Record<string, string>
  className?: string
}

export function StatusBadge({ status, colorMap, labelMap, className }: StatusBadgeProps) {
  const colors = colorMap[status] ?? 'bg-gray-100 text-gray-600'
  const label = labelMap?.[status] ?? status
  return (
    <span
      className={`dot-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  )
}
