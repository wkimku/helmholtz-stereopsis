import { useEffect, useState } from 'react'
import { dataUrl } from '../data/loader'
import { useCurrentScene } from '../data/SceneContext'

type PairsMeta = {
  variants: { N: number; shape: [number, number] }[]
}

/** §7 main interactive: side-by-side grid of N=3/6/9/18 depth+normal so the
 *  noise drop is visible at a glance. */
export function PairsComparison() {
  const { current } = useCurrentScene()
  const [meta, setMeta] = useState<PairsMeta | null>(null)
  const [missing, setMissing] = useState(false)
  const baseUrl = dataUrl(`data/${current}_pairs/`)

  useEffect(() => {
    let cancelled = false
    setMeta(null)
    setMissing(false)
    fetch(baseUrl + 'meta.json').then(
      async (r) => {
        if (cancelled) return
        if (!r.ok) {
          setMissing(true)
          return
        }
        const json = await r.json()
        if (!cancelled) setMeta(json)
      },
      () => {
        if (!cancelled) setMissing(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  if (missing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Pairs-comparison dataset for <code>{current}</code> not found at{' '}
        <code>data/{current}_pairs/</code>. Run{' '}
        <code className="font-mono">python -m pipeline.pairs_comparison</code> to produce it.
      </div>
    )
  }
  if (!meta) return <div className="text-sm text-slate-500">Loading…</div>

  const variants = meta.variants

  return (
    <div className="space-y-4">
      {/* Depth row — all N variants visible at once. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {variants.map((v) => (
          <Tile
            key={`d-${v.N}`}
            src={`${baseUrl}N${v.N}/depth_vis.png`}
            label={`N = ${v.N}`}
            sub="depth"
            highlight={v.N === variants[variants.length - 1].N}
          />
        ))}
      </div>
      {/* Normal row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {variants.map((v) => (
          <Tile
            key={`n-${v.N}`}
            src={`${baseUrl}N${v.N}/normal_vis.png`}
            label={`N = ${v.N}`}
            sub="normal"
            highlight={v.N === variants[variants.length - 1].N}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Each additional pair contributes one row to the constraint matrix{' '}
        <code>W</code>, making it harder for a wrong depth to satisfy them all
        simultaneously. The jump from N = 3 to N = 6 is dramatic; from N = 9 to
        N = 18 the gain is modest. In practice 9 pairs is a reasonable
        trade-off between capture time and result quality.
      </p>
    </div>
  )
}

function Tile({
  src,
  label,
  sub,
  highlight,
}: {
  src: string
  label: string
  sub: string
  highlight?: boolean
}) {
  return (
    <figure>
      <div
        className={`aspect-square overflow-hidden rounded-lg border bg-black/90 p-1 ${
          highlight ? 'border-accent/60 ring-2 ring-accent/30' : 'border-slate-200'
        }`}
      >
        <img src={src} alt={`${label} ${sub}`} className="h-full w-full rounded object-contain" />
      </div>
      <figcaption className="mt-1 text-center text-xs text-slate-600">
        <span className="font-medium">{label}</span>{' '}
        <span className="text-slate-400">· {sub}</span>
      </figcaption>
    </figure>
  )
}
