import { useCurrentScene } from '../data/SceneContext'

/** Scene picker — appears in the sidebar (full) and the header (compact, on small screens). */
export function SceneSelector({ compact = false }: { compact?: boolean }) {
  const { current, setCurrent, available } = useCurrentScene()

  if (compact) {
    return (
      <select
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
      >
        {available.map((s) => (
          <option key={s.name} value={s.name}>{s.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div>
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-slate-400">
        Scene
      </p>
      <p className="mb-3 text-xs text-slate-500">
        Switches every figure below at once.
      </p>
      <div className="space-y-1.5">
        {available.map((s) => {
          const active = s.name === current
          return (
            <button
              key={s.name}
              onClick={() => setCurrent(s.name)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
