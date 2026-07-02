import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  SANDBOX_BASE_URL,
  checkSandboxHealth,
  pollJob,
  startRun,
} from '../data/sandbox'
import type { JobState, RunSettings, WebPayload } from '../data/sandbox'
import { viridis } from '../data/colormap'
import { OrbitHint } from './OrbitHint'

const DEFAULTS: RunSettings = {
  resolution: 192,
  samples: 32,
  pairs: 6,
  depthSteps: 96,
  radius: 0.75,
  objectDistance: 3.0,
  imageNoise: 0,
  object: 'suzanne',
  material: 'noise',
}

type ServerStatus = 'checking' | 'up' | 'down'

/** §10 main interactive: param sandbox that talks to the user's local server. */
export function SandboxSection() {
  const [status, setStatus] = useState<ServerStatus>('checking')
  const [params, setParams] = useState<RunSettings>(DEFAULTS)
  const [job, setJob] = useState<JobState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WebPayload | null>(null)
  const [running, setRunning] = useState(false)
  const stopPollingRef = useRef(false)

  // Health check on mount + every 5 s while no run is active.
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const ok = await checkSandboxHealth()
      if (!cancelled) setStatus(ok ? 'up' : 'down')
    }
    void probe()
    const id = window.setInterval(probe, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  async function handleRun() {
    setError(null)
    setResult(null)
    setJob(null)
    setRunning(true)
    stopPollingRef.current = false
    try {
      const initial = await startRun(params)
      setJob(initial)
      // Poll loop
      while (!stopPollingRef.current) {
        await new Promise((r) => window.setTimeout(r, 800))
        const next = await pollJob(initial.jobId)
        setJob(next)
        if (next.status === 'done') {
          setResult(next.result?.result ?? null)
          break
        }
        if (next.status === 'error') {
          const msg = typeof next.error === 'string'
            ? next.error
            : next.error?.output?.slice(-2000) ?? next.message
          throw new Error(msg)
        }
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <ServerStatusBanner status={status} />
      <SandboxControls
        params={params}
        onChange={setParams}
        disabled={status !== 'up' || running}
      />
      <RunBar
        canRun={status === 'up' && !running}
        running={running}
        job={job}
        error={error}
        onRun={handleRun}
      />
      {result && <SandboxResults result={result} />}
    </div>
  )
}

function ServerStatusBanner({ status }: { status: ServerStatus }) {
  if (status === 'checking') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Probing local server…
      </div>
    )
  }
  if (status === 'down') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Local server not detected.</p>
        <p className="mt-1">
          To use this section you need Blender installed and the local pipeline server
          running. From the repo root:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-amber-900/10 p-2 text-xs text-amber-900">
{`cd sandbox
python3 -m hs_demo.server`}
        </pre>
        <p className="mt-2 text-xs text-amber-800">
          The page polls <code>{SANDBOX_BASE_URL}/api/health</code> every five seconds and
          will switch on automatically once the server is up.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
      ✓ Local server detected at <code>{SANDBOX_BASE_URL}</code>. Pick parameters and
      hit Run — the pipeline will render reciprocal pairs in Blender, solve depth, and
      send the result back.
    </div>
  )
}

function SandboxControls({
  params,
  onChange,
  disabled,
}: {
  params: RunSettings
  onChange: (p: RunSettings) => void
  disabled: boolean
}) {
  function set<K extends keyof RunSettings>(key: K, value: RunSettings[K]) {
    onChange({ ...params, [key]: value })
  }
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <Field label="Object">
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={params.object}
          onChange={(e) => set('object', e.target.value as RunSettings['object'])}
          disabled={disabled}
        >
          <option value="suzanne">Suzanne (Blender's monkey)</option>
          <option value="cube">Cube</option>
          <option value="sphere">Sphere</option>
        </select>
      </Field>
      <Field label="Reflectance">
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={params.material}
          onChange={(e) => set('material', e.target.value as RunSettings['material'])}
          disabled={disabled}
        >
          <option value="noise">noise (procedural)</option>
          <option value="matte">matte (Lambertian)</option>
          <option value="checker">checker</option>
        </select>
      </Field>
      <Slider
        label="Reciprocal pairs"
        value={params.pairs}
        min={3}
        max={18}
        step={1}
        onChange={(v) => set('pairs', v)}
        disabled={disabled}
      />
      <Slider
        label="Depth-search steps"
        value={params.depthSteps}
        min={16}
        max={256}
        step={1}
        onChange={(v) => set('depthSteps', v)}
        disabled={disabled}
      />
      <Slider
        label="Resolution"
        value={params.resolution}
        min={64}
        max={512}
        step={32}
        onChange={(v) => set('resolution', v)}
        disabled={disabled}
      />
      <Slider
        label="Render samples"
        value={params.samples}
        min={1}
        max={256}
        step={1}
        onChange={(v) => set('samples', v)}
        disabled={disabled}
      />
      <Field label="Pair radius">
        <input
          type="number"
          step={0.05}
          min={0.1}
          max={2}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={params.radius}
          onChange={(e) => set('radius', Number(e.target.value))}
          disabled={disabled}
        />
      </Field>
      <Field label="Object distance">
        <input
          type="number"
          step={0.1}
          min={1.5}
          max={6}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={params.objectDistance}
          onChange={(e) => set('objectDistance', Number(e.target.value))}
          disabled={disabled}
        />
      </Field>
      <Field label="Image noise (σ)">
        <input
          type="number"
          step={1}
          min={0}
          max={30}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
          value={params.imageNoise}
          onChange={(e) => set('imageNoise', Number(e.target.value))}
          disabled={disabled}
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <Field label={`${label}: ${value}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
        disabled={disabled}
      />
    </Field>
  )
}

function RunBar({
  canRun,
  running,
  job,
  error,
  onRun,
}: {
  canRun: boolean
  running: boolean
  job: JobState | null
  error: string | null
  onRun: () => void
}) {
  const progress = job?.progress ?? 0
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          disabled={!canRun}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Running…' : 'Run pipeline'}
        </button>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-500">{progress}%</span>
      </div>
      {job && (
        <p className="text-xs text-slate-600">
          Stage <span className="font-mono">{job.stage}</span>: {job.message}
        </p>
      )}
      {error && (
        <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </pre>
      )}
    </div>
  )
}

function SandboxResults({ result }: { result: WebPayload }) {
  const front = result.run?.viewData?.front
  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-medium text-ink">Result</h4>

      {front?.previews && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PreviewTile label="Depth" url={front.previews.depth} />
          <PreviewTile label="Normal" url={front.previews.normal} />
        </div>
      )}

      <SandboxPointCloud result={result} />

      {front?.stats && (
        <p className="text-xs text-slate-500">
          {front.stats.validPixels?.toLocaleString() ?? 0} valid pixels;
          {' '}depth ∈ [{front.stats.depthMin?.toFixed(2) ?? '?'}, {front.stats.depthMax?.toFixed(2) ?? '?'}];
          {' '}mean σ₂/σ₁ confidence {front.stats.confidenceMean?.toFixed(2) ?? '?'}.
        </p>
      )}
    </div>
  )
}

function PreviewTile({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return (
      <div>
        <div className="aspect-square rounded-lg bg-slate-100" />
        <p className="figure-caption text-center">{label} (missing)</p>
      </div>
    )
  }
  return (
    <figure>
      <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-black/90 p-1">
        <img src={url} alt={label} className="h-full w-full rounded object-contain" />
      </div>
      <figcaption className="figure-caption text-center">{label}</figcaption>
    </figure>
  )
}

function SandboxPointCloud({ result }: { result: WebPayload }) {
  const buffers = useMemo(() => {
    const points = result.points || []
    const colors = result.colors || []
    const positions = new Float32Array(points.length * 3)
    const colArr = new Float32Array(points.length * 3)

    let zMin = Infinity
    let zMax = -Infinity
    for (const [, , z] of points) {
      if (z < zMin) zMin = z
      if (z > zMax) zMax = z
    }
    const span = Math.max(1e-6, zMax - zMin)

    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = points[i]
      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      const c = colors[i]
      if (c && c.length === 3) {
        colArr[i * 3 + 0] = c[0]
        colArr[i * 3 + 1] = c[1]
        colArr[i * 3 + 2] = c[2]
      } else {
        const t = (z - zMin) / span
        const v = viridis(t)
        colArr[i * 3 + 0] = v[0]
        colArr[i * 3 + 1] = v[1]
        colArr[i * 3 + 2] = v[2]
      }
    }
    let cx = 0, cy = 0, cz = 0
    const n = points.length
    for (const [x, y, z] of points) {
      cx += x
      cy += y
      cz += z
    }
    return {
      positions,
      colors: colArr,
      count: n,
      center: n > 0 ? [cx / n, cy / n, cz / n] : [0, 0, 0],
    }
  }, [result])

  if (buffers.count === 0) {
    return <p className="text-sm text-slate-500">No points returned by the pipeline.</p>
  }

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
        <OrbitHint />
        <Canvas camera={{ position: [0, 0, -3], fov: 35 }} className="cursor-grab active:cursor-grabbing">
          <ambientLight intensity={0.85} />
          <points>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
              <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.012} vertexColors sizeAttenuation />
          </points>
          <OrbitControls
            makeDefault
            target={buffers.center as [number, number, number]}
          />
        </Canvas>
      </div>
      <p className="figure-caption text-center">
        {buffers.count.toLocaleString()} points (drag to orbit)
      </p>
    </div>
  )
}
