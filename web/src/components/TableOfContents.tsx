import { useEffect, useState } from 'react'
import { SECTIONS } from '../sections/manifest'

/** Sticky table of contents with active-section highlight via IntersectionObserver. */
export function TableOfContents() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose top is closest to the viewport top while still visible.
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0].target.id
        if (id) setActiveId(id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <nav className="text-sm">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-slate-400">Sections</p>
      <ol className="space-y-1.5">
        {SECTIONS.map((s) => {
          const active = s.id === activeId
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`group flex items-baseline gap-3 rounded-md px-2 py-1.5 transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    active ? 'text-accent' : 'text-slate-400'
                  }`}
                >
                  {s.number}
                </span>
                <span className="leading-snug">{s.title}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
