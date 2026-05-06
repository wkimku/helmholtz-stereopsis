import { useState } from 'react'

/**
 * §4 illustration: pretend you have a single pixel and you're sweeping the
 * candidate depth. Show the three singular values of W(P) as bars; at the
 * true depth (z=3.0) the smallest one drops to zero, signaling rank-2 and
 * the existence of a non-trivial null vector — the surface normal.
 *
 * The shape of the curves is a stylized model of the real behavior, not real
 * data. The point is to make "rank-2 search" visible at a glance.
 */
export function WMatrixFigure() {
  const Z_MIN = 2.0
  const Z_MAX = 4.0
  const Z_TRUE = 3.0
  const [z, setZ] = useState(2.4)

  const dist = Math.abs(z - Z_TRUE)
  // sigma1 stays large (well-conditioned in the dominant direction)
  const sigma1 = 1.0
  // sigma2 drops a bit at the true depth too (W gets closer to rank-1 in shape)
  const sigma2 = 0.6 + 0.05 * Math.cos((z - Z_TRUE) * Math.PI)
  // sigma3 has a sharp valley at z_true; this is the rank-2 condition
  const sigma3 = Math.min(1.0, 1.6 * dist * dist) + 0.02

  // Layout
  const W = 360
  const H = 180
  const pad = { l: 40, r: 12, t: 14, b: 36 }
  const cw = (W - pad.l - pad.r) / 3
  const yScale = (v: number) => H - pad.b - v * (H - pad.t - pad.b)

  const bars: { label: string; v: number; color: string }[] = [
    { label: 'σ₁', v: sigma1, color: '#6366f1' },
    { label: 'σ₂', v: sigma2, color: '#22d3ee' },
    { label: 'σ₃', v: sigma3, color: '#f59e0b' },
  ]

  const closeToTrue = dist < 0.06

  return (
    <figure className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#cbd5e1" />
        {bars.map((b, i) => {
          const x = pad.l + i * cw + 12
          const w = cw - 24
          const top = yScale(b.v)
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={top}
                width={w}
                height={H - pad.b - top}
                fill={b.color}
                rx={4}
                style={{ transition: 'all 250ms ease' }}
              />
              <text x={x + w / 2} y={H - pad.b + 16} textAnchor="middle" fontSize="12" fill="#0e1116">
                {b.label}
              </text>
              <text x={x + w / 2} y={Math.max(pad.t + 12, top - 6)} textAnchor="middle" fontSize="10" fill="#475569">
                {b.v.toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>candidate depth</span>
          <span className="font-mono tabular-nums">z = {z.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={Z_MIN}
          max={Z_MAX}
          step={0.01}
          value={z}
          onChange={(e) => setZ(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <p className={`text-xs ${closeToTrue ? 'text-emerald-700' : 'text-slate-500'}`}>
          {closeToTrue
            ? 'Near the true depth: σ₃ → 0, so W is rank-2 and admits a non-trivial null vector — that null vector is the surface normal.'
            : 'Away from the true depth: all three singular values are nonzero, so W is full rank and the constraint W·n = 0 has no non-trivial solution.'}
        </p>
      </div>
    </figure>
  )
}
