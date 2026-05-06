import { useEffect, useState } from 'react'

/**
 * §2 figure — paper convention.
 *
 * In the Zickler 2002 paper, the two reciprocal positions are labeled `O_l`
 * (left) and `O_r` (right) and the unit vectors `v_l = (O_l - P)/|O_l - P|`,
 * `v_r = (O_r - P)/|O_r - P|` point from the surface point P toward those
 * fixed positions. The vectors do **not** depend on which device (camera or
 * light) is at which position — they are pure geometry. What changes between
 * the two captures of a reciprocal pair is only the assignment "camera at A,
 * light at B" ↔ "camera at B, light at A".
 *
 * The arrows below stay fixed; the colored circles at A and B swap between
 * a camera (indigo) and a light (amber) every couple of seconds.
 */
export function ReciprocityFigure() {
  const [swapped, setSwapped] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setSwapped((s) => !s), 2200)
    return () => clearInterval(id)
  }, [])

  // SVG viewBox (0..400 x 0..240).
  const A = { x: 100, y: 60 }
  const B = { x: 300, y: 60 }
  const P = { x: 200, y: 180 }

  // Shrink each arrow so the tip stops outside the marker circles.
  const SHRINK = 16
  const aTip = shorten(P, A, SHRINK)
  const bTip = shorten(P, B, SHRINK)

  return (
    <figure className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <svg viewBox="0 0 400 240" className="w-full">
        {/* Surface */}
        <path
          d="M 30 200 Q 200 130 370 200"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
        />
        <circle cx={P.x} cy={P.y} r={4} fill="#0e1116" />
        {/* Surface normal */}
        <line
          x1={P.x}
          y1={P.y}
          x2={P.x}
          y2={P.y - 50}
          stroke="#0e1116"
          strokeWidth="1.5"
          markerEnd="url(#arrow-ink)"
        />
        <text x={P.x + 6} y={P.y - 36} fontSize="11" fill="#0e1116">
          n̂
        </text>

        {/* Fixed arrow P → A. Labeled v_l. */}
        <line
          x1={P.x}
          y1={P.y}
          x2={aTip.x}
          y2={aTip.y}
          stroke="#475569"
          strokeWidth="2"
          markerEnd="url(#arrow-slate)"
        />
        {/* Fixed arrow P → B. Labeled v_r. */}
        <line
          x1={P.x}
          y1={P.y}
          x2={bTip.x}
          y2={bTip.y}
          stroke="#475569"
          strokeWidth="2"
          markerEnd="url(#arrow-slate)"
        />

        {/* Labels placed just off the arrow lines (outer side, away from the
            normal n) with a real subscript so rendering matches the paper. */}
        <text x={142} y={135} fontSize="14" fontStyle="italic" fill="#475569">
          v̂
          <tspan dy="3" fontSize="10" fontStyle="italic">l</tspan>
        </text>
        <text x={258} y={135} fontSize="14" fontStyle="italic" fill="#475569">
          v̂
          <tspan dy="3" fontSize="10" fontStyle="italic">r</tspan>
        </text>

        {/* Position markers. Only the device role at each position swaps. */}
        <Marker pos={A} label="A" role={swapped ? 'light' : 'camera'} />
        <Marker pos={B} label="B" role={swapped ? 'camera' : 'light'} />

        <defs>
          <marker
            id="arrow-ink"
            viewBox="0 0 10 10"
            markerWidth="8"
            markerHeight="8"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#0e1116" />
          </marker>
          <marker
            id="arrow-slate"
            viewBox="0 0 10 10"
            markerWidth="6"
            markerHeight="6"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
        </defs>
      </svg>
      <p className="mt-3 text-sm text-slate-600">
        Camera at{' '}
        <span className="font-mono text-accent">{swapped ? 'B' : 'A'}</span>,
        light at{' '}
        <span className="font-mono text-amber-600">{swapped ? 'A' : 'B'}</span>.
        The vectors <span className="italic">v̂_l</span> and{' '}
        <span className="italic">v̂_r</span> stay fixed — they describe the
        geometry, not the device assignment.
      </p>
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
      <circle
        cx={pos.x}
        cy={pos.y}
        r={11}
        fill={fill}
        stroke="#fff"
        strokeWidth="2"
        style={{ transition: 'fill 700ms' }}
      />
      <text
        x={pos.x}
        y={pos.y + 4}
        fontSize="11"
        textAnchor="middle"
        fill="#fff"
        fontWeight="bold"
      >
        {label}
      </text>
      <text
        x={pos.x}
        y={pos.y - 16}
        fontSize="10"
        textAnchor="middle"
        fill="#475569"
        style={{ transition: 'all 300ms' }}
      >
        {isCam ? 'camera' : 'light'}
      </text>
    </g>
  )
}

function shorten(
  from: { x: number; y: number },
  to: { x: number; y: number },
  by: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  const t = d > 0 ? Math.max(0, d - by) / d : 0
  return { x: from.x + dx * t, y: from.y + dy * t }
}
