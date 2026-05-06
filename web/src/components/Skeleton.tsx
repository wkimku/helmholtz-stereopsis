/**
 * Tiny layout-preserving placeholder for slow loads (binaries fetched from
 * /data/<scene>/). Uses Tailwind's `animate-pulse` so the wait feels active
 * instead of stuck. Pass `aspect="square"` for the click-image columns and
 * leave it default for inline panels.
 */
export function Skeleton({
  label,
  aspect,
  className = '',
}: {
  label?: string
  aspect?: 'square'
  className?: string
}) {
  const aspectClass = aspect === 'square' ? 'aspect-square' : ''
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-400 ${aspectClass} ${className}`}
    >
      <span className="animate-pulse">{label ?? 'Loading…'}</span>
    </div>
  )
}
