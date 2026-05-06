import type { LoadedScene, SceneMeta } from './types'

/** Resolve a path relative to the deployed base URL (handles GitHub Pages base). */
export function dataUrl(relPath: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const trimmedBase = base.endsWith('/') ? base : base + '/'
  const trimmedRel = relPath.startsWith('/') ? relPath.slice(1) : relPath
  return trimmedBase + trimmedRel
}

export async function loadSceneMeta(name: string): Promise<LoadedScene> {
  const baseUrl = dataUrl(`data/${name}/`)
  const res = await fetch(baseUrl + 'meta.json')
  if (!res.ok) throw new Error(`scene meta ${name}: HTTP ${res.status}`)
  const meta = (await res.json()) as SceneMeta
  return { meta, baseUrl }
}

export async function loadFloat32(url: string): Promise<Float32Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return new Float32Array(buf)
}

export type CostVolumeData = {
  values: Float32Array      // length = h * w * nz, row-major (y, x, z)
  h: number
  w: number
  nz: number
  zMin: number
  zMax: number
}

export async function loadCostVolume(scene: LoadedScene): Promise<CostVolumeData | null> {
  const cv = scene.meta.cost_volume
  if (!cv) return null
  const values = await loadFloat32(scene.baseUrl + 'cost_volume.bin')
  const [h, w, nz] = cv.shape
  return { values, h, w, nz, zMin: cv.z_min, zMax: cv.z_max }
}

/** Look up cost(z) for one (image-space normalized) pixel. */
export function costCurveAtPixel(
  cv: CostVolumeData,
  /** image x in [0, 1] (0 = left) */
  uNorm: number,
  /** image y in [0, 1] (0 = top) */
  vNorm: number,
): { z: number[]; cost: number[] } {
  const xi = Math.min(cv.w - 1, Math.max(0, Math.floor(uNorm * cv.w)))
  const yi = Math.min(cv.h - 1, Math.max(0, Math.floor(vNorm * cv.h)))
  const dz = (cv.zMax - cv.zMin) / Math.max(1, cv.nz - 1)
  const z = new Array<number>(cv.nz)
  const cost = new Array<number>(cv.nz)
  for (let k = 0; k < cv.nz; k++) {
    z[k] = cv.zMin + k * dz
    // values laid out (h, w, nz) row-major: idx = (yi * w + xi) * nz + k
    cost[k] = cv.values[(yi * cv.w + xi) * cv.nz + k]
  }
  return { z, cost }
}
