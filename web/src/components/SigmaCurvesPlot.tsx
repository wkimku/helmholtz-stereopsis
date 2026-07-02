/**
 * Shared log-scale plot of the three singular values σ₁ ≤ σ₂ ≤ σ₃ of W(P) as a
 * function of candidate depth z. Used by §4 (the W-matrix figure) and §5 (the
 * cost-curve explorer's optional breakdown view) so the two stay identical.
 *
 * The caller passes the curves plus the depth `peakZ` to mark (usually the
 * argmax of the shipped cost volume, so the marker matches the depth map).
 */

export const SIGMA_COLORS = {
  sigma1: '#6366f1', // smallest — the rank-deficient direction at the true depth
  sigma2: '#22d3ee', // middle
  sigma3: '#f59e0b', // largest
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻',
}

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT_DIGITS[c] ?? c)
    .join('')
}

export function SigmaCurvesPlot({
  z,
  sigma1,
  sigma2,
  sigma3,
  peakZ,
}: {
  z: number[]
  sigma1: number[]
  sigma2: number[]
  sigma3: number[]
  peakZ: number
}) {
  // Nearest sigma-grid index to the marked depth.
  let peakIdx = 0
  let best = Infinity
  for (let i = 0; i < z.length; i++) {
    const d = Math.abs(z[i] - peakZ)
    if (d < best) {
      best = d
      peakIdx = i
    }
  }

  const W = 360
  const H = 220
  const pad = { l: 44, r: 12, t: 14, b: 28 }
  const xMin = z[0]
  const xMax = z[z.length - 1]

  const allVals = [...sigma1, ...sigma2, ...sigma3].filter((v) => Number.isFinite(v) && v > 0)
  const rawMax = allVals.length ? Math.max(...allVals) : 1
  const rawMin = allVals.length ? Math.min(...allVals) : 1e-6
  const logMax = Math.log10(rawMax)
  const logMin = Math.min(logMax - 1, Math.log10(Math.max(rawMin, rawMax * 1e-6)))
  const eps = rawMax * 1e-7

  const xScale = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r)
  const yScale = (v: number) => {
    const lv = Math.log10(Math.max(v, eps))
    const t = (lv - logMin) / Math.max(1e-9, logMax - logMin)
    return H - pad.b - t * (H - pad.t - pad.b)
  }

  const polyline = (vals: number[]) =>
    z.map((zi, i) => `${xScale(zi).toFixed(1)},${yScale(vals[i]).toFixed(1)}`).join(' ')

  const decades: number[] = []
  for (let d = Math.ceil(logMin); d <= Math.floor(logMax); d++) decades.push(d)
  if (decades.length === 0) decades.push(Math.round((logMin + logMax) / 2))

  return (
    <div className="mt-4 space-y-2">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <rect
          x={pad.l}
          y={pad.t}
          width={W - pad.l - pad.r}
          height={H - pad.t - pad.b}
          fill="#fafafa"
          stroke="#e5e7eb"
        />
        {decades.map((d) => (
          <g key={d}>
            <line
              x1={pad.l}
              y1={yScale(Math.pow(10, d))}
              x2={W - pad.r}
              y2={yScale(Math.pow(10, d))}
              stroke="#e5e7eb"
            />
            <text
              x={pad.l - 4}
              y={yScale(Math.pow(10, d))}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="#64748b"
            >
              10{toSuperscript(d)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((t) => {
          const v = xMin + t * (xMax - xMin)
          return (
            <text
              key={t}
              x={xScale(v)}
              y={H - pad.b + 14}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {v.toFixed(2)}
            </text>
          )
        })}
        {/* Curves: largest first so the smallest one paints on top. */}
        <polyline points={polyline(sigma3)} fill="none" stroke={SIGMA_COLORS.sigma3} strokeWidth="1.6" />
        <polyline points={polyline(sigma2)} fill="none" stroke={SIGMA_COLORS.sigma2} strokeWidth="1.6" />
        <polyline points={polyline(sigma1)} fill="none" stroke={SIGMA_COLORS.sigma1} strokeWidth="2.0" />
        <circle cx={xScale(peakZ)} cy={yScale(sigma1[peakIdx])} r={4} fill={SIGMA_COLORS.sigma1} />
        <line
          x1={xScale(peakZ)}
          y1={pad.t}
          x2={xScale(peakZ)}
          y2={H - pad.b}
          stroke={SIGMA_COLORS.sigma1}
          strokeDasharray="3 3"
          opacity="0.4"
        />
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#64748b">
          candidate depth z
        </text>
        <text
          x={pad.l - 36}
          y={(H - pad.b + pad.t) / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
          transform={`rotate(-90 ${pad.l - 36} ${(H - pad.b + pad.t) / 2})`}
        >
          σ (log)
        </text>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
        <Legend color={SIGMA_COLORS.sigma1} label="σ₁ (smallest)" />
        <Legend color={SIGMA_COLORS.sigma2} label="σ₂" />
        <Legend color={SIGMA_COLORS.sigma3} label="σ₃ (largest)" />
        <span className="ml-auto">
          peak σ₂/σ₁ at <span className="font-mono">z = {peakZ.toFixed(3)}</span>
        </span>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
