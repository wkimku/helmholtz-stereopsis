import { useEffect, useState } from 'react'

/** Thin accent bar pinned to the top of the header that fills as the reader
 *  moves through the page. Passive scroll listener, rAF-throttled. */
export function ScrollProgress() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let ticking = false
    const update = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      setPct(max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0)
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
      <div
        className="h-full bg-accent transition-[width] duration-75 ease-out"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}
