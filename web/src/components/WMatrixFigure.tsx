import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../hooks/useScene'
import { loadSigmaVolume, loadCostVolume, sigmaCurvesAtPixel, costCurveAtPixel } from '../data/loader'
import type { SigmaVolumeData, CostVolumeData } from '../data/loader'
import { Skeleton } from './Skeleton'
import { SigmaCurvesPlot } from './SigmaCurvesPlot'

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
  const [cv, setCv] = useState<CostVolumeData | null>(null)
  const [pixel, setPixel] = useState<Pixel | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!scene) return
    let cancelled = false
    setLoading(true)
    setSv(null)
    setCv(null)
    setPixel(null)
    // Load the sigma volume for the three curves and the cost volume for the
    // peak marker. Marking the peak from the cost volume keeps §4's marker
    // identical to §5 and to the shipped depth map (both driven by cost).
    Promise.all([loadSigmaVolume(scene), loadCostVolume(scene)])
      .then(([sigma, cost]) => {
        if (cancelled) return
        setSv(sigma)
        setCv(cost)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSv(null)
        setCv(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scene])

  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <figure className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {scene ? (
        <ClickableImage src={`${scene.baseUrl}base_rgb.png`} onPick={setPixel} marker={pixel} />
      ) : (
        <Skeleton aspect="square" label="Loading scene…" />
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">Singular values vs candidate depth</p>
        <p className="mt-1 text-xs text-slate-500">
          σ₁, σ₂, σ₃ of W(P) at the clicked pixel as the candidate depth{' '}
          <em>z</em> sweeps through the scene. The vertical line marks the
          depth this pixel resolves to — the same peak §5 and the depth map use.
        </p>
        {loading && (
          <Skeleton className="mt-4 h-44" label="Loading sigma volume…" />
        )}
        {!loading && !sv && scene && (
          <div className="mt-6 text-sm text-slate-500">
            No sigma volume shipped with this scene yet — re-run the pipeline export.
          </div>
        )}
        {sv && pixel && <SigmaPlot sv={sv} cv={cv} pixel={pixel} />}
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

function SigmaPlot({ sv, cv, pixel }: { sv: SigmaVolumeData; cv: CostVolumeData | null; pixel: Pixel }) {
  const { z, sigma1, sigma2, sigma3 } = useMemo(
    () => sigmaCurvesAtPixel(sv, pixel.uNorm, pixel.vNorm),
    [sv, pixel],
  )

  // Mark the peak using the shipped cost volume (σ₂/σ₁ smoothed the same way as
  // the depth map), so §4's marker lands on the exact depth §5 and the depth
  // map report. Fall back to the ratio of the plotted sigmas if the cost volume
  // is unavailable.
  const peakZ = useMemo(() => {
    let best = 0
    let bestVal = -Infinity
    if (cv) {
      const { z: cz, cost } = costCurveAtPixel(cv, pixel.uNorm, pixel.vNorm)
      for (let i = 0; i < cost.length; i++) {
        if (cost[i] > bestVal) {
          bestVal = cost[i]
          best = i
        }
      }
      return cz[best]
    }
    for (let i = 0; i < sigma1.length; i++) {
      const r = sigma2[i] / Math.max(1e-12, sigma1[i])
      if (r > bestVal) {
        bestVal = r
        best = i
      }
    }
    return z[best]
  }, [z, sigma1, sigma2, cv, pixel])

  return <SigmaCurvesPlot z={z} sigma1={sigma1} sigma2={sigma2} sigma3={sigma3} peakZ={peakZ} />
}
