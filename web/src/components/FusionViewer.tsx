import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { dataUrl, loadFloat32 } from '../data/loader'
import { useCurrentScene } from '../data/SceneContext'
import { viridis } from '../data/colormap'
import { Skeleton } from './Skeleton'
import { OrbitHint } from './OrbitHint'

type CloudSet = {
  positions: Float32Array   // (N*3)
  normals: Float32Array     // (N*3)
  viewIndices: Int8Array    // (N,)
}

type Merged = {
  smooth: CloudSet
  raw: CloudSet | null
  poseNames: string[]
  center: [number, number, number]
}

type DepthSource = 'smooth' | 'raw'
type ColorMode = 'normal' | 'depth'

const VIEW_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.94, 0.40, 0.36], [0.34, 0.62, 0.92], [0.46, 0.78, 0.40],
  [0.97, 0.78, 0.20], [0.66, 0.50, 0.92], [0.30, 0.78, 0.78],
]

/**
 * §8 main interactive: merged multi-view point cloud.
 * - Toggle which capture sessions contribute (per-view buttons).
 * - Pick a color mode: surface normal (the algorithm's direct output) or
 *   depth from the canonical front camera.
 * - Switch the underlying point positions between the F-C smooth depth and
 *   the raw per-pixel depth to see what the integration step buys you.
 */
export function FusionViewer() {
  const { current } = useCurrentScene()
  const [data, setData] = useState<Merged | null>(null)
  const [enabled, setEnabled] = useState<boolean[]>([])
  const [missing, setMissing] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('normal')
  const [pointSize, setPointSize] = useState(0.013)
  const [source, setSource] = useState<DepthSource>('smooth')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setMissing(false)
    void loadMerged(current).then(
      (m) => {
        if (cancelled) return
        setData(m)
        setEnabled(m.poseNames.map(() => true))
      },
      () => {
        if (!cancelled) setMissing(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [current])

  if (missing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        The fused 3D reconstruction for <code>{current}</code> is temporarily
        unavailable.
        {import.meta.env.DEV && (
          <>
            {' '}
            Merged dataset not found at <code>data/{current}_full/</code> — render
            the six poses and run <code className="font-mono">pipeline.merge_views</code>.
          </>
        )}
      </div>
    )
  }
  if (!data) return <Skeleton className="h-96" label="Loading multi-view point cloud…" />

  const activeSet = source === 'raw' && data.raw ? data.raw : data.smooth
  const visibleCount = countVisible(activeSet.viewIndices, enabled)
  const rawAvailable = data.raw !== null

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
        <OrbitHint />
        <Canvas camera={{ position: [0, 0, -3], fov: 35 }} className="cursor-grab active:cursor-grabbing">
          <ambientLight intensity={0.85} />
          <Points
            cloud={activeSet}
            mask={enabled}
            colorMode={colorMode}
            pointSize={pointSize}
          />
          <OrbitControls makeDefault target={data.center} />
        </Canvas>
      </div>

      {/* Per-view toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Views</span>
        {data.poseNames.map((name, i) => (
          <button
            key={name}
            onClick={() => setEnabled((e) => e.map((v, j) => (j === i ? !v : v)))}
            className={`rounded-md border px-2 py-1 text-xs ${
              enabled[i] ? 'border-transparent text-white' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
            style={enabled[i] ? { backgroundColor: hex(VIEW_PALETTE[i]) } : undefined}
          >
            {name}
          </button>
        ))}
        <span className="grow" />
        <span className="text-xs text-slate-500">{visibleCount.toLocaleString()} points</span>
      </div>

      {/* Depth source + Color mode + point size */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Depth source</p>
          <div className="flex gap-1">
            <ToggleButton
              active={source === 'smooth'}
              onClick={() => setSource('smooth')}
            >
              smooth
              <br />
              <span className="whitespace-nowrap text-[10px] opacity-80">(Frankot-Chellappa)</span>
            </ToggleButton>
            <ToggleButton
              active={source === 'raw'}
              disabled={!rawAvailable}
              onClick={() => setSource('raw')}
            >
              raw
              <br />
              <span className="whitespace-nowrap text-[10px] opacity-80">(per-pixel)</span>
            </ToggleButton>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Color by</p>
          <div className="flex gap-1">
            <ToggleButton active={colorMode === 'normal'} onClick={() => setColorMode('normal')}>normal</ToggleButton>
            <ToggleButton active={colorMode === 'depth'} onClick={() => setColorMode('depth')}>depth</ToggleButton>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Point size</span>
            <span className="font-mono tabular-nums">{pointSize.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={0.003}
            max={0.04}
            step={0.001}
            value={pointSize}
            onChange={(e) => setPointSize(Number(e.target.value))}
            className="mt-1 w-full accent-accent"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Switch the depth source to compare the per-pixel raw depth (noisy,
        speckled surfaces) with the Frankot-Chellappa integration of the
        normal map (smooth surfaces). The "depth" coloring uses each point's
        position along the canonical front-to-back axis, so closer points
        toward the original camera are darker.
        {!rawAvailable && (
          <>{' '}<span className="text-amber-600">
            (Raw point cloud not yet exported for this scene — re-run merge_views.)
          </span></>
        )}
      </p>
    </div>
  )
}

function ToggleButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-md px-2 py-1 text-xs leading-tight disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Points({
  cloud,
  mask,
  colorMode,
  pointSize,
}: {
  cloud: CloudSet
  mask: boolean[]
  colorMode: ColorMode
  pointSize: number
}) {
  const { pos, col } = useMemo(
    () => buildBuffers(cloud.positions, cloud.normals, cloud.viewIndices, mask, colorMode),
    [cloud, mask, colorMode],
  )
  return (
    <points key={`pts-${pos.length}-${colorMode}`}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
      <pointsMaterial size={pointSize} vertexColors sizeAttenuation />
    </points>
  )
}

function buildBuffers(
  positions: Float32Array,
  normals: Float32Array,
  viewIndices: Int8Array,
  mask: boolean[],
  colorMode: ColorMode,
): { pos: Float32Array; col: Float32Array } {
  const n = positions.length / 3
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)

  // Depth axis: canonical y. In the canonical frame Suzanne's face points along
  // -y, so points closer to the front camera have smaller y, which we map to
  // dark viridis (purple) and farther points to light (yellow).
  let yMin = Infinity
  let yMax = -Infinity
  if (colorMode === 'depth') {
    for (let i = 0; i < n; i++) {
      if (!mask[viewIndices[i]]) continue
      const y = positions[i * 3 + 1]
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }
  const ySpan = Math.max(1e-6, yMax - yMin)

  let w = 0
  for (let i = 0; i < n; i++) {
    const v = viewIndices[i]
    if (!mask[v]) continue

    pos[w * 3 + 0] = positions[i * 3 + 0]
    pos[w * 3 + 1] = positions[i * 3 + 1]
    pos[w * 3 + 2] = positions[i * 3 + 2]

    let r: number, g: number, b: number
    if (colorMode === 'normal') {
      r = normals[i * 3 + 0] * 0.5 + 0.5
      g = normals[i * 3 + 1] * 0.5 + 0.5
      b = normals[i * 3 + 2] * 0.5 + 0.5
    } else {
      const t = (positions[i * 3 + 1] - yMin) / ySpan
      const c = viridis(t)
      r = c[0]; g = c[1]; b = c[2]
    }
    col[w * 3 + 0] = r
    col[w * 3 + 1] = g
    col[w * 3 + 2] = b

    w++
  }
  return {
    pos: pos.slice(0, w * 3),
    col: col.slice(0, w * 3),
  }
}

function countVisible(viewIndices: Int8Array, mask: boolean[]): number {
  let n = 0
  for (let i = 0; i < viewIndices.length; i++) {
    if (mask[viewIndices[i]]) n++
  }
  return n
}

function hex([r, g, b]: readonly [number, number, number]): string {
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

async function loadCloudSet(baseUrl: string, suffix: string = ''): Promise<CloudSet> {
  const [positions, normals, viewBuf] = await Promise.all([
    loadFloat32(baseUrl + `points${suffix}.bin`),
    loadFloat32(baseUrl + `normals${suffix}.bin`),
    fetch(baseUrl + `view_indices${suffix}.bin`).then((r) => r.arrayBuffer()),
  ])
  return { positions, normals, viewIndices: new Int8Array(viewBuf) }
}

async function loadMerged(scene: string): Promise<Merged> {
  const baseUrl = dataUrl(`data/${scene}_full/`)
  const metaRes = await fetch(baseUrl + 'meta.json')
  if (!metaRes.ok) throw new Error('not found')
  const meta = (await metaRes.json()) as { pose_names: string[] }

  // Strip the scene prefix from the per-view labels so they're consistent
  // across scenes (the per-pose render directories use scene-prefixed names
  // for everything except suzanne).
  const prefix = `${scene}_`
  const poseNames = meta.pose_names.map((n) => (n.startsWith(prefix) ? n.slice(prefix.length) : n))

  const smooth = await loadCloudSet(baseUrl)

  let raw: CloudSet | null = null
  try {
    raw = await loadCloudSet(baseUrl, '_raw')
  } catch {
    raw = null
  }

  // Centroid of the smooth cloud (used as the orbit target).
  let cx = 0, cy = 0, cz = 0
  const n = smooth.positions.length / 3
  for (let i = 0; i < n; i++) {
    cx += smooth.positions[i * 3 + 0]
    cy += smooth.positions[i * 3 + 1]
    cz += smooth.positions[i * 3 + 2]
  }
  return {
    smooth,
    raw,
    poseNames,
    center: n > 0 ? [cx / n, cy / n, cz / n] : [0, 0, 0],
  }
}
