import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../hooks/useScene'
import { loadFloat32 } from '../data/loader'
import { viridis } from '../data/colormap'
import { Skeleton } from './Skeleton'

type RawData = {
  depth: Float32Array      // length W*H, raw per-pixel
  depthFc: Float32Array | null  // length W*H, F-C-integrated smooth depth (optional)
  normal: Float32Array     // length W*H*3
  cost: Float32Array       // length W*H
  bgMask: Uint8Array       // length W*H, 1 = foreground
  W: number
  H: number
}

type DepthSource = 'raw' | 'fc'

/**
 * §6 interactive: depth and normal maps that respond to a confidence filter
 * slider plus a depth-source toggle. "Raw" shows the per-pixel depth output
 * of the search; "Smooth" shows depth recovered from the (cleaner) normal map
 * via Frankot-Chellappa integration.
 */
export function ConfidenceFilterSlider() {
  const { scene } = useScene()
  const [data, setData] = useState<RawData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [pct, setPct] = useState(15)
  const [source, setSource] = useState<DepthSource>('raw')
  const [normalMode, setNormalMode] = useState<'rgb' | 'relit'>('rgb')
  const [lightAngle, setLightAngle] = useState(135) // degrees, azimuth of the relight
  const depthRef = useRef<HTMLCanvasElement>(null)
  const normalRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!scene) return
    let cancelled = false
    setData(null)
    setLoadError(false)
    void loadRaw(scene.baseUrl, scene.meta.width, scene.meta.height, !!scene.meta.has_depth_fc)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [scene])

  const stats = useMemo(() => {
    if (!data) return null
    return computeStats(data, pct, source)
  }, [data, pct, source])

  useEffect(() => {
    if (!data || !stats || !depthRef.current || !normalRef.current) return
    drawDepth(depthRef.current, data, stats, source)
    drawNormal(normalRef.current, data, stats, normalMode, lightAngle)
  }, [data, stats, source, normalMode, lightAngle])

  if (!scene) return <Skeleton className="h-64" label="Loading scene…" />
  if (loadError)
    return <div className="text-sm text-red-500">Failed to load the depth/normal maps for this scene.</div>
  if (!data) return <Skeleton className="h-64" label="Loading raw maps…" />

  const fcAvailable = data.depthFc !== null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CanvasFigure
          label={source === 'fc' ? 'Depth (smooth, from normals)' : 'Depth (raw, per-pixel)'}
          canvasRef={depthRef}
          W={data.W}
          H={data.H}
        />
        <CanvasFigure
          label={normalMode === 'rgb' ? 'Normal (n̂ → RGB)' : 'Normal, re-lit'}
          canvasRef={normalRef}
          W={data.W}
          H={data.H}
        >
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-slate-200 text-[11px]">
              <button
                onClick={() => setNormalMode('rgb')}
                className={`px-2 py-0.5 ${normalMode === 'rgb' ? 'bg-accent text-white' : 'bg-white text-slate-600'}`}
              >
                n̂ → RGB
              </button>
              <button
                onClick={() => setNormalMode('relit')}
                className={`px-2 py-0.5 ${normalMode === 'relit' ? 'bg-accent text-white' : 'bg-white text-slate-600'}`}
              >
                re-lit
              </button>
            </div>
            {normalMode === 'relit' && (
              <label className="flex flex-1 items-center gap-2 text-[11px] text-slate-500">
                light
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={lightAngle}
                  onChange={(e) => setLightAngle(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </label>
            )}
          </div>
        </CanvasFigure>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Depth source</p>
          <div className="flex gap-1">
            <SourceButton
              active={source === 'raw'}
              onClick={() => setSource('raw')}
              hint="The depth-search output. Per-pixel and noisy."
            >
              raw
            </SourceButton>
            <SourceButton
              active={source === 'fc'}
              disabled={!fcAvailable}
              onClick={() => setSource('fc')}
              hint="Frankot-Chellappa integration of the normal map. Smooth."
            >
              smooth
              <br />
              <span className="whitespace-nowrap">(Frankot-Chellappa)</span>
            </SourceButton>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
            <span className="min-w-0">
              Drop bottom-N percent of pixels by <span className="whitespace-nowrap">σ₂/σ₁ confidence</span>
            </span>
            <span className="whitespace-nowrap font-mono tabular-nums">N = {pct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="mt-1 w-full accent-accent"
          />
        </div>
      </div>

      {stats && (
        <p className="text-xs text-slate-500">
          Threshold cost ≥{' '}
          <span className="font-mono">
            {Number.isFinite(stats.threshold) ? stats.threshold.toFixed(3) : '0 (keep all)'}
          </span>
          ; keeping {stats.keptCount.toLocaleString()} / {stats.fgCount.toLocaleString()}{' '}
          foreground pixels ({((stats.keptCount / Math.max(1, stats.fgCount)) * 100).toFixed(1)}%).
          {!fcAvailable && (
            <>
              {' '}<span className="text-amber-600">
                (Smooth depth not available for this scene — re-run precompute to generate it.)
              </span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function SourceButton({
  active,
  disabled,
  onClick,
  hint,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  hint: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`flex-1 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function CanvasFigure({
  label,
  canvasRef,
  W,
  H,
  children,
}: {
  label: string
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  W: number
  H: number
  children?: React.ReactNode
}) {
  return (
    <figure>
      <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-black">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="h-full w-full object-contain"
        />
      </div>
      <figcaption className="figure-caption text-center">{label}</figcaption>
      {children}
    </figure>
  )
}

type Stats = {
  threshold: number
  keptCount: number
  fgCount: number
  depthLo: number
  depthHi: number
  keepMask: Uint8Array
}

function computeStats(d: RawData, pct: number, source: DepthSource): Stats {
  const N = d.W * d.H
  const fgCosts: number[] = []
  for (let i = 0; i < N; i++) {
    if (d.bgMask[i]) fgCosts.push(d.cost[i])
  }
  fgCosts.sort((a, b) => a - b)
  const k = Math.floor((pct / 100) * fgCosts.length)
  // At 0% keep *every* foreground pixel: use -Infinity so the strict `> threshold`
  // test below never drops the lowest-cost pixels (which sit exactly at the
  // minimum). Matches confidence_mask() in the Python pipeline.
  const threshold =
    pct <= 0 || fgCosts.length === 0 ? -Infinity : fgCosts[Math.min(k, fgCosts.length - 1)]

  const depthArr = source === 'fc' && d.depthFc ? d.depthFc : d.depth

  // Compute color range from ALL foreground pixels (independent of the slider)
  // so dragging the filter only changes which pixels are visible — not the
  // color mapping itself. F-C boundary outliers get a wider trim.
  const fgDepths: number[] = []
  for (let i = 0; i < N; i++) {
    if (d.bgMask[i]) fgDepths.push(depthArr[i])
  }
  fgDepths.sort((a, b) => a - b)
  const tail = source === 'fc' ? 0.1 : 0.02
  let depthLo = 0
  let depthHi = 1
  if (fgDepths.length > 0) {
    const loIdx = Math.floor(fgDepths.length * tail)
    const hiIdx = Math.min(fgDepths.length - 1, Math.floor(fgDepths.length * (1 - tail)))
    depthLo = fgDepths[loIdx]
    depthHi = fgDepths[hiIdx] > depthLo + 1e-6 ? fgDepths[hiIdx] : depthLo + 1e-6
  }

  const keepMask = new Uint8Array(N)
  let keptCount = 0
  for (let i = 0; i < N; i++) {
    if (d.bgMask[i] && d.cost[i] > threshold) {
      keepMask[i] = 1
      keptCount++
    }
  }
  return {
    threshold,
    keptCount,
    fgCount: fgCosts.length,
    depthLo,
    depthHi,
    keepMask,
  }
}

function drawDepth(canvas: HTMLCanvasElement, d: RawData, stats: Stats, source: DepthSource) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(d.W, d.H)
  const depthArr = source === 'fc' && d.depthFc ? d.depthFc : d.depth
  const span = Math.max(1e-6, stats.depthHi - stats.depthLo)
  for (let i = 0; i < d.W * d.H; i++) {
    const j = i * 4
    if (stats.keepMask[i]) {
      // Clamp to [0, 1] since percentile range may exclude the pixel's value.
      const t = Math.max(0, Math.min(1, (depthArr[i] - stats.depthLo) / span))
      const [r, g, b] = viridis(t)
      img.data[j] = r * 255
      img.data[j + 1] = g * 255
      img.data[j + 2] = b * 255
      img.data[j + 3] = 255
    } else {
      img.data[j + 3] = 0
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawNormal(
  canvas: HTMLCanvasElement,
  d: RawData,
  stats: Stats,
  mode: 'rgb' | 'relit' = 'rgb',
  lightAngleDeg = 135,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(d.W, d.H)

  // Relight direction: azimuth in the image plane, tilted toward the viewer so
  // the whole (z-facing) surface stays lit rather than half-black.
  const az = (lightAngleDeg * Math.PI) / 180
  const lz = 0.55
  const lx = Math.cos(az)
  const ly = Math.sin(az)
  const ln = Math.hypot(lx, ly, lz)
  const L = [lx / ln, ly / ln, lz / ln]

  for (let i = 0; i < d.W * d.H; i++) {
    const j = i * 4
    if (!stats.keepMask[i]) {
      img.data[j + 3] = 0
      continue
    }
    const ni = i * 3
    const nx = d.normal[ni]
    const ny = d.normal[ni + 1]
    const nz = d.normal[ni + 2]
    if (mode === 'relit') {
      // Lambertian shade n̂·L, with a little ambient so shadows aren't pure black.
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
      const shade = Math.min(1, 0.12 + 0.88 * diff)
      const v = shade * 255
      img.data[j] = v
      img.data[j + 1] = v
      img.data[j + 2] = v
    } else {
      img.data[j] = (nx * 0.5 + 0.5) * 255
      img.data[j + 1] = (ny * 0.5 + 0.5) * 255
      img.data[j + 2] = (nz * 0.5 + 0.5) * 255
    }
    img.data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

async function loadRaw(baseUrl: string, W: number, H: number, hasFc: boolean): Promise<RawData> {
  const [depth, normal, cost] = await Promise.all([
    loadFloat32(baseUrl + 'depth.bin'),
    loadFloat32(baseUrl + 'normal.bin'),
    loadFloat32(baseUrl + 'cost.bin'),
  ])
  let depthFc: Float32Array | null = null
  if (hasFc) {
    try {
      depthFc = await loadFloat32(baseUrl + 'depth_fc.bin')
    } catch {
      depthFc = null
    }
  }
  const N = W * H
  const bgMask = new Uint8Array(N)
  for (let i = 0; i < N; i++) bgMask[i] = depth[i] > 0 ? 1 : 0
  return { depth, depthFc, normal, cost, bgMask, W, H }
}
