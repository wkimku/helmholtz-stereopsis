import { useEffect, useState } from 'react'

/**
 * §2 figure — paper convention, now interactive.
 *
 * The two reciprocal positions are labeled `A = O_l` (left) and `B = O_r`
 * (right); the unit vectors `v_l, v_r` point from the surface point P toward
 * them and are pure geometry — they don't depend on which device sits where.
 * What changes between the two captures of a reciprocal pair is only the
 * assignment "camera at A, light at B" ↔ "camera at B, light at A".
 *
 * The reflected light path (light → P → camera) reverses when you swap, but the
 * BRDF value f_r evaluated for that in/out pair is identical — that is Helmholtz
 * reciprocity, and it is the one fact the whole method rests on.
 */
export function ReciprocityFigure() {
  const [swapped, setSwapped] = useState(false)
  // Don't auto-animate for users who prefer reduced motion — they can still
  // press "Auto-play" or step through with "Swap".
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setSwapped((s) => !s), 2400)
    return () => clearInterval(id)
  }, [playing])

  // SVG viewBox (0..400 x 0..240).
  const A = { x: 100, y: 60 }
  const B = { x: 300, y: 60 }
  const P = { x: 200, y: 180 }

  const SHRINK = 16
  const aTip = shorten(P, A, SHRINK)
  const bTip = shorten(P, B, SHRINK)

  // Which position currently holds the camera / light.
  const cameraAt = swapped ? B : A
  const lightAt = swapped ? A : B

  return (
    <figure className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <svg viewBox="0 0 400 240" className="w-full">
        {/* Surface */}
        <path d="M 30 200 Q 200 130 370 200" fill="none" stroke="#94a3b8" strokeWidth="2" />
        <circle cx={P.x} cy={P.y} r={4} fill="#0e1116" />
        {/* Surface normal */}
        <line x1={P.x} y1={P.y} x2={P.x} y2={P.y - 50} stroke="#0e1116" strokeWidth="1.5" markerEnd="url(#arrow-ink)" />
        <text x={P.x + 6} y={P.y - 36} fontSize="11" fill="#0e1116">
          n̂
        </text>

        {/* Reflected light path: incoming ray from the light to P, outgoing ray
            from P to the camera. Animated dashes give a sense of direction. */}
        <line
          x1={lightAt.x}
          y1={lightAt.y}
          x2={P.x}
          y2={P.y}
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="5 4"
          opacity="0.9"
          style={{ transition: 'all 700ms' }}
        >
          <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite" />
        </line>
        <line
          x1={P.x}
          y1={P.y}
          x2={cameraAt.x}
          y2={cameraAt.y}
          stroke="#6366f1"
          strokeWidth="2"
          strokeDasharray="5 4"
          opacity="0.9"
          style={{ transition: 'all 700ms' }}
        >
          <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite" />
        </line>

        {/* Fixed geometry arrows P → A (v_l) and P → B (v_r), drawn thin under labels. */}
        <line x1={P.x} y1={P.y} x2={aTip.x} y2={aTip.y} stroke="#94a3b8" strokeWidth="1" markerEnd="url(#arrow-slate)" />
        <line x1={P.x} y1={P.y} x2={bTip.x} y2={bTip.y} stroke="#94a3b8" strokeWidth="1" markerEnd="url(#arrow-slate)" />
        <text x={142} y={135} fontSize="14" fontStyle="italic" fill="#64748b">
          v̂<tspan dy="3" fontSize="10" fontStyle="italic">l</tspan>
        </text>
        <text x={258} y={135} fontSize="14" fontStyle="italic" fill="#64748b">
          v̂<tspan dy="3" fontSize="10" fontStyle="italic">r</tspan>
        </text>

        <Marker pos={A} label="A" role={swapped ? 'light' : 'camera'} />
        <Marker pos={B} label="B" role={swapped ? 'camera' : 'light'} />

        <defs>
          <marker id="arrow-ink" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 z" fill="#0e1116" />
          </marker>
          <marker id="arrow-slate" viewBox="0 0 10 10" markerWidth="6" markerHeight="6" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>

      {/* Reciprocity callout: the in/out directions flip, the BRDF value doesn't. */}
      <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-center text-sm">
        <span className="font-mono">
          f<sub>r</sub>(
          <span className="text-amber-600">{swapped ? 'v̂_l' : 'v̂_r'}</span> →{' '}
          <span className="text-accent">{swapped ? 'v̂_r' : 'v̂_l'}</span>)
        </span>{' '}
        =
        <span className="font-mono">
          {' '}f<sub>r</sub>(
          <span className="text-amber-600">{swapped ? 'v̂_r' : 'v̂_l'}</span> →{' '}
          <span className="text-accent">{swapped ? 'v̂_l' : 'v̂_r'}</span>)
        </span>
        <span className="ml-2 text-slate-400">— same value either way</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <button
          onClick={() => setSwapped((s) => !s)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        >
          Swap camera ↔ light
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {playing ? 'Pause' : 'Auto-play'}
        </button>
        <span className="ml-auto text-xs">
          <span className="text-amber-600">■</span> light in ·{' '}
          <span className="text-accent">■</span> view out — the vectors{' '}
          <span className="italic">v̂_l, v̂_r</span> never move.
        </span>
      </div>
    </figure>
  )
}

function Marker({
  pos,
  label,
  role,
}: {
  pos: { x: number; y: number }
  label: string
  role: 'camera' | 'light'
}) {
  const isCam = role === 'camera'
  const fill = isCam ? '#6366f1' : '#fbbf24'
  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r={11} fill={fill} stroke="#fff" strokeWidth="2" style={{ transition: 'fill 700ms' }} />
      <text x={pos.x} y={pos.y + 4} fontSize="11" textAnchor="middle" fill="#fff" fontWeight="bold">
        {label}
      </text>
      <text x={pos.x} y={pos.y - 16} fontSize="10" textAnchor="middle" fill="#475569" style={{ transition: 'all 300ms' }}>
        {isCam ? 'camera' : 'light'}
      </text>
    </g>
  )
}

function shorten(from: { x: number; y: number }, to: { x: number; y: number }, by: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  const t = d > 0 ? Math.max(0, d - by) / d : 0
  return { x: from.x + dx * t, y: from.y + dy * t }
}
