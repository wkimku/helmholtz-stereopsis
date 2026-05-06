// Types and small fetch helpers for the local-server sandbox in §10.

export const SANDBOX_BASE_URL = 'http://127.0.0.1:8765'

export type RunSettings = {
  runName?: string
  resolution: number
  samples: number
  pairs: number
  depthSteps: number
  radius: number
  objectDistance: number
  imageNoise: number
  object: 'suzanne' | 'cube' | 'sphere'
  material: 'noise' | 'matte' | 'checker'
}

export type JobState = {
  ok: boolean
  jobId: string
  status: 'queued' | 'running' | 'done' | 'error'
  stage: string
  progress: number
  message: string
  result: RunResult | null
  error?: { command?: string[]; output?: string } | string | null
}

export type RunResult = {
  ok: boolean
  runDir: string
  webJson: string
  settings: Record<string, unknown>
  result: WebPayload
}

export type WebPayload = {
  schema?: string
  points: number[][]
  colors: number[][]
  normals: number[][]
  pointCloud?: {
    pointCount: number
    sourcePointCount: number
    maxPoints: number
  }
  run?: {
    path: string
    views: string[]
    viewData: Record<string, ViewBundle>
  }
}

export type ViewBundle = {
  name: string
  capture: { capture?: Record<string, unknown> }
  solver: Record<string, unknown>
  stats: {
    validPixels?: number
    depthMin?: number
    depthMax?: number
    confidenceMean?: number
    confidenceMax?: number
  }
  previews: {
    depth?: string  // base64 data URL
    normal?: string
    confidence?: string
  }
}

/** Quick health check; returns true if the local server is up and responding. */
export async function checkSandboxHealth(timeoutMs = 1500): Promise<boolean> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${SANDBOX_BASE_URL}/api/health`, { signal: ctrl.signal })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(t)
  }
}

export async function startRun(settings: RunSettings): Promise<JobState> {
  const res = await fetch(`${SANDBOX_BASE_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  const body = await res.json()
  if (!res.ok || !body.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'failed to start run')
  }
  return body
}

export async function pollJob(jobId: string): Promise<JobState> {
  const res = await fetch(`${SANDBOX_BASE_URL}/api/run/${jobId}`)
  const body = await res.json()
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'poll failed')
  }
  return body
}
