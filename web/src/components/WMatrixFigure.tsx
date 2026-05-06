import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../hooks/useScene'
import { loadSigmaVolume, sigmaCurvesAtPixel } from '../data/loader'
import type { SigmaVolumeData } from '../data/loader'

type Pixel = { u: number; v: number; uNorm: number; vNorm: number }

/**
 * §4 figure: click any pixel on the base image and watch the three singular
 * values of W(P) — sigma_1 <= sigma_2 <= sigma_3 — as a function of candidate
 * depth. Curves come straight from the precomputed sigma volume (downsampled).
 *
 * At the true depth sigma_1 dives toward zero (rank-deficient direction = the
 * surface normal). sigma_2 and sigma_3 stay non-zero. Off-surface, all three
 * are roughly the same order of magnitude — that's the "no rank deficiency"
 * regime.
 */
export function WMatrixFigure() {
  const { scene, error } = useScene()
  const [sv, setSv] = useState<SigmaVolumeData | null>(null)
  const [pixel, setPixel] = useState<Pixel | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!scene) return
    setLoading(true)
    setSv(null)
    setPixel(null)
    loadSigmaVolume(scene).then((data) => {
      setSv(data)
      setLoading(false)
    })
  }, [scene])

  if (error) return <div className="text-sm text-red-500">{error}</div>
  if (!scene) return <div className="text-sm text-slate-500">Loading scene…</div>

  return (
    <figure className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ClickableImage src={`${scene.baseUrl}base_rgb.png`} onPick={setPixel} marker={pixel} />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">Singular values vs candidate depth</p>
        <p className="mt-1 text-xs text-slate-500">
          σ₁, σ₂, σ₃ of W(P) at the clicked pixel as the candidate depth sweeps
          along the camera ray. The vertical line marks the depth where σ₂/σ₁
          peaks.
        </p>
        {loading && <div className="mt-6 text-sm text-slate-500">Loading sigma volume…</div>}
        {!loading && !sv && (
          <div className="mt-6 text-sm text-slate-500">
            No sigma volume shipped with this scene yet — re-run the pipeline export.
          </div>
        )}
        {sv && pixel && <SigmaPlot sv={sv} pixel={pixel} />}
        {sv && !pixel && (
          <div className="mt-6 text-sm text-slate-500">Click anywhere on the image →</div>
        )}
      </div>
    </figure>
  )
}

function ClickableImage({
  src,
  onPick,
  marker,
}: {
  src: string
  onPick: (p: Pixel) => void
  marker: Pixel | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    onPick({
      u: x,
      v: y,
      uNorm: Math.max(0, Math.min(1, x / rect.width)),
      vNorm: Math.max(0, Math.min(1, y / rect.height)),
    })
  }

  return (
    <div
      ref={ref}
      className="relative aspect-square cursor-crosshair overflow-hidden rounded-lg border border-slate-200 bg-black"
      onClick={handleClick}
    >
      <img src={src} alt="base" className="absolute inset-0 h-full w-full object-contain" />
      {marker && (
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
          style={{ left: marker.u, top: marker.v, backgroundColor: '#6366f1' }}
        />
      )}
    </div>
  )
}

const COLORS = {
  sigma1: '#6366f1', // smallest — the rank-deficient direction at the true depth
  sigma2: '#22d3ee', // middle
  sigma3: '#f59e0b', // largest
}

function SigmaPlot({ sv, pixel }: { sv: SigmaVolumeData; pixel: Pixel }) {
  const { z, sigma1, sigma2, sigma3 } = useMemo(
    () => sigmaCurvesAtPixel(sv, pixel.uNorm, pixel.vNorm),
    [sv, pixel],
  )

  // Find peak of sigma_2 / sigma_1 (the cost score from §4 prose).
  const { peakZ, peakIdx } = useMemo(() => {
    let best = 0
    let bestVal = -Infinity
    for (let i = 0; i < sigma1.length; i++) {
      const r = sigma2[i] / Math.max(1e-12, sigma1[i])
      if (r > bestVal) {
        bestVal = r
        best = i
      }
    }
    return { peakZ: z[best], peakIdx: best }
  }, [z, sigma1, sigma2])

  // Plot on a log y-axis: sigma_1 can be many orders of magnitude smaller than
  // sigma_3 at the rank-deficient depth, and the "dip" we want to show only
  // becomes visible once we span a few decades.
  const W = 360
  const H = 220
  const pad = { l: 44, r: 12, t: 14, b: 28 }
  const xMin = z[0]
  const xMax = z[z.length - 1]

  const allVals = [...sigma1, ...sigma2, ...sigma3].filter((v) => Number.isFinite(v) && v > 0)
  const rawMax = allVals.length ? Math.max(...allVals) : 1
  const rawMin = allVals.length ? Math.min(...allVals) : 1e-6
  // Clamp the log-y window so it never collapses to a single point.
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

  // Pick integer log decades inside [logMin, logMax] for y-axis labels.
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
        {/* y-axis: log decades */}
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
        {/* x-axis ticks */}
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
        <polyline points={polyline(sigma3)} fill="none" stroke={COLORS.sigma3} strokeWidth="1.6" />
        <polyline points={polyline(sigma2)} fill="none" stroke={COLORS.sigma2} strokeWidth="1.6" />
        <polyline points={polyline(sigma1)} fill="none" stroke={COLORS.sigma1} strokeWidth="2.0" />
        {/* Peak marker on sigma_1 (where it dips). */}
        <circle cx={xScale(peakZ)} cy={yScale(sigma1[peakIdx])} r={4} fill={COLORS.sigma1} />
        <line
          x1={xScale(peakZ)}
          y1={pad.t}
          x2={xScale(peakZ)}
          y2={H - pad.b}
          stroke={COLORS.sigma1}
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
        <Legend color={COLORS.sigma1} label="σ₁ (smallest)" />
        <Legend color={COLORS.sigma2} label="σ₂" />
        <Legend color={COLORS.sigma3} label="σ₃ (largest)" />
        <span className="ml-auto">
          peak σ₂/σ₁ at <span className="font-mono">z = {peakZ.toFixed(3)}</span>
        </span>
      </div>
    </div>
  )
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
