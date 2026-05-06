import { useEffect, useState } from 'react'
import { dataUrl } from '../data/loader'
import { useCurrentScene } from '../data/SceneContext'

type PairsMeta = {
  variants: { N: number; shape: [number, number] }[]
}

/** §7 main interactive: 4-up grid + slider showing how the result improves with more pairs. */
export function PairsComparison() {
  const { current } = useCurrentScene()
  const [meta, setMeta] = useState<PairsMeta | null>(null)
  const [active, setActive] = useState(0)
  const [missing, setMissing] = useState(false)
  const baseUrl = dataUrl(`data/${current}_pairs/`)

  useEffect(() => {
    setMeta(null)
    setMissing(false)
    fetch(baseUrl + 'meta.json').then(
      async (r) => {
        if (!r.ok) {
          setMissing(true)
          return
        }
        setMeta(await r.json())
      },
      () => setMissing(true),
    )
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
  const variant = variants[active] ?? variants[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Tile
          src={`${baseUrl}N${variant.N}/depth_vis.png`}
          label={`Depth — N = ${variant.N}`}
        />
        <Tile
          src={`${baseUrl}N${variant.N}/normal_vis.png`}
          label={`Normal — N = ${variant.N}`}
        />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Reciprocal pairs used</span>
          <span className="font-mono tabular-nums">N = {variant.N}</span>
        </div>
        <div className="mt-2 flex gap-2">
          {variants.map((v, i) => (
            <button
              key={v.N}
              onClick={() => setActive(i)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                i === active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              N = {v.N}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Note how noise drops as N increases. Each additional pair contributes one row to the
        constraint matrix W, making it harder for a wrong depth to satisfy them all simultaneously.
      </p>
    </div>
  )
}

function Tile({ src, label }: { src: string; label: string }) {
  return (
    <figure>
      <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-black/90 p-1">
        <img src={src} alt={label} className="h-full w-full rounded object-contain" />
      </div>
      <figcaption className="figure-caption text-center">{label}</figcaption>
    </figure>
  )
}
