import { useMemo, useRef, useState } from 'react'
import { useCurrentScene } from '../data/SceneContext'
import { loadSceneMeta, loadCostVolume, costCurveAtPixel } from '../data/loader'
import type { CostVolumeData } from '../data/loader'

type Loaded = { name: string; label: string; baseUrl: string; cv: CostVolumeData }

const SCENE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4']

/**
 * Overlay the σ₂/σ₁ cost curve at the *same image-space pixel* across every
 * scene, so you can see how depth ambiguity depends on geometry (e.g. the
 * on-axis center is sharply peaked on Suzanne's nose but flat/multi-modal on
 * the sphere and cube). Loads three cost volumes, so it is opt-in.
 */
export function CrossSceneCompare() {
  const { available } = useCurrentScene()
  const [loaded, setLoaded] = useState<Loaded[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uv, setUv] = useState({ u: 0.5, v: 0.5 })

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const out: Loaded[] = []
      for (const s of available) {
        const scene = await loadSceneMeta(s.name)
        const cv = await loadCostVolume(scene)
        if (cv) out.push({ name: s.name, label: s.label, baseUrl: scene.baseUrl, cv })
      }
      setLoaded(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p>
          Compare the same image pixel across every scene at once — the on-axis
          center is a clean peak on some geometries and ambiguous on others.
        </p>
        <button
          onClick={loadAll}
          disabled={loading}
          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? 'Loading cost volumes…' : `Load comparison (${available.length} scenes)`}
        </button>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {loaded.map((s, i) => (
            <button
              key={s.name}
              className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-black"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setUv({
                  u: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                  v: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                })
              }}
            >
              <img src={`${s.baseUrl}base_rgb.png`} alt={s.label} className="absolute inset-0 h-full w-full object-contain" />
              <span
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ left: `${uv.u * 100}%`, top: `${uv.v * 100}%`, backgroundColor: SCENE_COLORS[i % SCENE_COLORS.length] }}
              />
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Click any thumbnail to move the shared pixel. It lands at the same
          normalized (x, y) on every scene.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">σ₂/σ₁ vs depth, per scene</p>
        <OverlayPlot loaded={loaded} uv={uv} />
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {loaded.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: SCENE_COLORS[i % SCENE_COLORS.length] }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function OverlayPlot({ loaded, uv }: { loaded: Loaded[]; uv: { u: number; v: number } }) {
  const curves = useMemo(
    () => loaded.map((s) => ({ ...costCurveAtPixel(s.cv, uv.u, uv.v) })),
    [loaded, uv],
  )
  const ref = useRef<SVGSVGElement>(null)

  const W = 360
  const H = 220
  const pad = { l: 32, r: 10, t: 12, b: 24 }
  const xMin = Math.min(...curves.map((c) => c.z[0]))
  const xMax = Math.max(...curves.map((c) => c.z[c.z.length - 1]))
  // Normalize each curve to its own max so shapes are comparable across scenes.
  const norm = curves.map((c) => {
    const m = Math.max(1e-9, ...c.cost)
    return c.cost.map((v) => v / m)
  })
  const xScale = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (W - pad.l - pad.r)
  const yScale = (v: number) => H - pad.b - v * (H - pad.t - pad.b)

  return (
    <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="mt-3 overflow-visible">
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="#fafafa" stroke="#e5e7eb" />
      {[0, 0.5, 1].map((t) => (
        <text key={t} x={xScale(xMin + t * (xMax - xMin))} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="#64748b">
          {(xMin + t * (xMax - xMin)).toFixed(2)}
        </text>
      ))}
      {curves.map((c, i) => (
        <polyline
          key={i}
          points={c.z.map((zi, k) => `${xScale(zi).toFixed(1)},${yScale(norm[i][k]).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={SCENE_COLORS[i % SCENE_COLORS.length]}
          strokeWidth="1.6"
        />
      ))}
      <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="10" fill="#64748b">
        candidate depth z
      </text>
      <text x={pad.l - 22} y={pad.t + 6} fontSize="10" fill="#64748b">
        cost
      </text>
    </svg>
  )
}
