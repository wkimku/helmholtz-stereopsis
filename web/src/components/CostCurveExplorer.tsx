import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../hooks/useScene'
import { loadCostVolume, costCurveAtPixel } from '../data/loader'
import type { CostVolumeData } from '../data/loader'
import { Skeleton } from './Skeleton'

type Pixel = { u: number; v: number; uNorm: number; vNorm: number }

/** Section 5 main interactive: click a pixel, see cost(z). */
export function CostCurveExplorer() {
  const { scene, error } = useScene()
  const [cv, setCv] = useState<CostVolumeData | null>(null)
  const [pixel, setPixel] = useState<Pixel | null>(null)
  const [loadingCv, setLoadingCv] = useState(false)

  useEffect(() => {
    if (!scene) return
    let cancelled = false
    setLoadingCv(true)
    setCv(null)
    setPixel(null) // stale marker belongs to the previous scene's image
    loadCostVolume(scene)
      .then((data) => {
        if (cancelled) return
        setCv(data)
        setLoadingCv(false)
      })
      .catch(() => {
        if (cancelled) return
        setCv(null)
        setLoadingCv(false)
      })
    return () => {
      cancelled = true
    }
  }, [scene])

  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {scene ? (
        <ClickableImage
          src={`${scene.baseUrl}base_rgb.png`}
          onPick={setPixel}
          marker={pixel}
        />
      ) : (
        <Skeleton aspect="square" label="Loading scene…" />
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">Cost vs depth</p>
        <p className="mt-1 text-xs text-slate-500">
          Plot of σ₂/σ₁ for the clicked pixel. The peak indicates the most likely depth.
        </p>
        {loadingCv && (
          <Skeleton className="mt-4 h-44" label="Loading cost volume…" />
        )}
        {cv && pixel && <CostPlot cv={cv} pixel={pixel} />}
        {cv && !pixel && (
          <div className="mt-6 text-sm text-slate-500">Click anywhere on the image →</div>
        )}
      </div>
    </div>
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
          style={{
            left: `${marker.uNorm * 100}%`,
            top: `${marker.vNorm * 100}%`,
            backgroundColor: '#6366f1',
          }}
        />
      )}
    </div>
  )
}

function CostPlot({ cv, pixel }: { cv: CostVolumeData; pixel: Pixel }) {
  const { z, cost } = useMemo(() => costCurveAtPixel(cv, pixel.uNorm, pixel.vNorm), [cv, pixel])
  // Find peak depth.
  const peakIdx = useMemo(() => {
    let best = 0
    for (let i = 1; i < cost.length; i++) if (cost[i] > cost[best]) best = i
    return best
  }, [cost])
  const peakZ = z[peakIdx]
  const peakCost = cost[peakIdx]

  // Render with a small SVG for crispness; one polyline plus markers.
  const W = 360
  const H = 220
  const pad = { l: 36, r: 12, t: 14, b: 26 }
  const xMin = z[0]
  const xMax = z[z.length - 1]
  const yMin = 0
  const yMax = Math.max(1e-6, peakCost)
  const xScale = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r)
  const yScale = (v: number) =>
    H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b)

  const points = z.map((zi, i) => `${xScale(zi).toFixed(1)},${yScale(cost[i]).toFixed(1)}`).join(' ')

  return (
    <div className="mt-4 space-y-2">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="#fafafa" stroke="#e5e7eb" />
        {/* y-axis ticks */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              y1={yScale(yMin + t * (yMax - yMin))}
              x2={W - pad.r}
              y2={yScale(yMin + t * (yMax - yMin))}
              stroke="#e5e7eb"
            />
            <text
              x={pad.l - 4}
              y={yScale(yMin + t * (yMax - yMin))}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="#64748b"
            >
              {(yMin + t * (yMax - yMin)).toFixed(1)}
            </text>
          </g>
        ))}
        {/* x-axis ticks */}
        {[0, 0.5, 1].map((t) => {
          const v = xMin + t * (xMax - xMin)
          return (
            <g key={t}>
              <text x={xScale(v)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="#64748b">
                {v.toFixed(2)}
              </text>
            </g>
          )
        })}
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="1.6" />
        <circle cx={xScale(peakZ)} cy={yScale(peakCost)} r={4} fill="#6366f1" />
        <line
          x1={xScale(peakZ)}
          y1={pad.t}
          x2={xScale(peakZ)}
          y2={H - pad.b}
          stroke="#6366f1"
          strokeDasharray="3 3"
          opacity="0.4"
        />
        <text x={W - pad.r} y={pad.t - 2} textAnchor="end" fontSize="10" fill="#64748b">
          σ₂ / σ₁
        </text>
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#64748b">
          candidate depth z
        </text>
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          pixel <span className="font-mono">({pixel.u | 0}, {pixel.v | 0})</span>
        </span>
        <span>
          peak at <span className="font-mono">z = {peakZ.toFixed(3)}</span>, cost{' '}
          <span className="font-mono">{peakCost.toFixed(2)}</span>
        </span>
      </div>
    </div>
  )
}
