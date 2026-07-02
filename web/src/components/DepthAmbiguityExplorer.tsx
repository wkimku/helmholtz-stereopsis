import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../hooks/useScene'
import { loadCostVolume, costCurveAtPixel } from '../data/loader'
import type { CostVolumeData } from '../data/loader'
import { Skeleton } from './Skeleton'

type Pixel = { uNorm: number; vNorm: number; label: string; color: string }

/**
 * §10 illustration: cost curves at hand-picked "good" and "bad" pixels for the
 * current scene, plotted together so students can see depth ambiguity directly.
 */
export function DepthAmbiguityExplorer() {
  const { scene, sceneName } = useScene()
  const [cv, setCv] = useState<CostVolumeData | null>(null)
  const [points, setPoints] = useState<Pixel[]>([])
  // Monotonic counter so each click gets a fresh palette index, even after the
  // ring buffer drops the oldest pixel. The previous code used `prev.length`,
  // which gets capped at the buffer size and then kept reusing the same color.
  // Initialized in the scene-change effect below.
  const [clickCount, setClickCount] = useState(2)
  const ref = useRef<HTMLDivElement>(null)

  // Reset comparisons whenever the scene changes. Start the click counter
  // past the preset color indices so the first user click already gets a fresh
  // hue (presets occupy ROTATE_COLORS[0..presets.length-1]).
  useEffect(() => {
    const presets = presetPixelsForScene(sceneName)
    setPoints(presets)
    setClickCount(presets.length)
  }, [sceneName])

  useEffect(() => {
    if (!scene) {
      setCv(null)
      return
    }
    let cancelled = false
    setCv(null)
    loadCostVolume(scene)
      .then((data) => {
        if (!cancelled) setCv(data)
      })
      .catch(() => {
        if (!cancelled) setCv(null)
      })
    return () => {
      cancelled = true
    }
  }, [scene])

  if (!scene) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton aspect="square" label="Loading scene…" />
        <Skeleton className="h-72" label="Loading cost volume…" />
      </div>
    )
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect()
    const u = (e.clientX - rect.left) / rect.width
    const v = (e.clientY - rect.top) / rect.height
    const colorIdx = clickCount % ROTATE_COLORS.length
    const next: Pixel = {
      uNorm: Math.max(0, Math.min(1, u)),
      vNorm: Math.max(0, Math.min(1, v)),
      label: `clicked pixel #${clickCount + 1}`,
      color: ROTATE_COLORS[colorIdx],
    }
    setClickCount((n) => n + 1)
    // Keep at most 4 comparisons (preserves user's most recent picks).
    setPoints((prev) => [...prev.slice(-3), next])
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <div
          ref={ref}
          className="relative aspect-square cursor-crosshair overflow-hidden rounded-lg border border-slate-200 bg-black"
          onClick={handleClick}
        >
          <img
            src={`${scene.baseUrl}base_rgb.png`}
            alt="base"
            className="absolute inset-0 h-full w-full object-contain"
          />
          {points.map((p, i) => (
            <div
              key={`${p.uNorm}-${p.vNorm}-${i}`}
              className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-md"
              style={{
                left: `${p.uNorm * 100}%`,
                top: `${p.vNorm * 100}%`,
                backgroundColor: p.color,
              }}
            >
              <span className="text-[10px] font-bold text-white">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Click to add a comparison pixel.</span>
          <span className="grow" />
          <button
            onClick={() => {
              const presets = presetPixelsForScene(sceneName)
              setPoints(presets)
              setClickCount(presets.length)
            }}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
          >
            reset to presets
          </button>
          <button
            onClick={() => {
              setPoints([])
              setClickCount(0)
            }}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
          >
            clear
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">σ₂/σ₁ vs depth</p>
        <p className="mt-1 text-xs text-slate-500">
          A clean single peak means the constraint pinpoints one depth. Multiple
          peaks of comparable height = the algorithm's "necessary but not
          sufficient" warning showing up as actual ambiguity in the data.
        </p>
        {!cv && <Skeleton className="mt-4 h-44" label="Loading cost volume…" />}
        {cv && <MultiCurvePlot cv={cv} points={points} />}
        <ul className="mt-4 space-y-1 text-xs text-slate-600">
          {points.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: p.color }}
              >
                {i + 1}
              </span>
              <span>{p.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const ROTATE_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#84cc16', // lime
]

/**
 * Hand-picked "good" and "bad" demo pixels per scene. The bad pixels exploit
 * the rotational symmetry of our circular camera/light layout: points near the
 * optical axis or in low-texture regions tend to admit multiple satisfying
 * depths.
 */
function presetPixelsForScene(name: string): Pixel[] {
  const presets: Record<string, Pixel[]> = {
    suzanne: [
      { uNorm: 0.5, vNorm: 0.42, label: 'on the eye (textured) — sharp peak', color: ROTATE_COLORS[0] },
      { uNorm: 0.5, vNorm: 0.5, label: 'between the eyes (smooth, on-axis) — multi-peak', color: ROTATE_COLORS[1] },
    ],
    cube: [
      { uNorm: 0.32, vNorm: 0.36, label: 'near a cube edge — sharp peak', color: ROTATE_COLORS[0] },
      { uNorm: 0.5, vNorm: 0.5, label: 'middle of a flat face — ambiguous', color: ROTATE_COLORS[1] },
    ],
    sphere: [
      { uNorm: 0.4, vNorm: 0.4, label: 'off-center on the sphere — sharp peak', color: ROTATE_COLORS[0] },
      { uNorm: 0.5, vNorm: 0.5, label: 'sphere center (on-axis symmetry) — ambiguous', color: ROTATE_COLORS[1] },
    ],
  }
  return presets[name] ?? presets.suzanne
}

function MultiCurvePlot({ cv, points }: { cv: CostVolumeData; points: Pixel[] }) {
  const curves = useMemo(
    () => points.map((p) => ({ ...p, ...costCurveAtPixel(cv, p.uNorm, p.vNorm) })),
    [cv, points],
  )
  const W = 360
  const H = 220
  const pad = { l: 36, r: 12, t: 14, b: 26 }
  if (curves.length === 0) {
    return <p className="mt-6 text-sm text-slate-500">Pick a pixel on the image →</p>
  }
  const xMin = curves[0].z[0]
  const xMax = curves[0].z[curves[0].z.length - 1]
  let yMax = 0
  for (const c of curves) for (const v of c.cost) if (v > yMax) yMax = v
  yMax = Math.max(1e-6, yMax)
  const xScale = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r)
  const yScale = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b)

  return (
    <div className="mt-4">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="#fafafa" stroke="#e5e7eb" />
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad.l} y1={pad.t + t * (H - pad.t - pad.b)} x2={W - pad.r} y2={pad.t + t * (H - pad.t - pad.b)} stroke="#e5e7eb" />
        ))}
        {curves.map((c, idx) => {
          const pts = c.z.map((zi, i) => `${xScale(zi).toFixed(1)},${yScale(c.cost[i]).toFixed(1)}`).join(' ')
          return (
            <g key={idx}>
              <polyline points={pts} fill="none" stroke={c.color} strokeWidth="1.6" />
            </g>
          )
        })}
        {[0, 0.5, 1].map((t) => {
          const v = xMin + t * (xMax - xMin)
          return (
            <text key={t} x={xScale(v)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="#64748b">
              {v.toFixed(2)}
            </text>
          )
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#64748b">candidate depth z</text>
      </svg>
    </div>
  )
}
