import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dataUrl } from './loader'

type SceneEntry = { name: string; label: string }

type SceneCtx = {
  current: string
  setCurrent: (name: string) => void
  available: SceneEntry[]
}

const Ctx = createContext<SceneCtx | null>(null)

const FALLBACK: SceneEntry[] = [{ name: 'cube', label: 'Cube' }]

export function SceneProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<string>('cube')
  const [available, setAvailable] = useState<SceneEntry[]>(FALLBACK)

  // Fetch the global scene index if present; otherwise fall back to the default.
  useEffect(() => {
    fetch(dataUrl('data/scenes.json')).then(
      async (r) => {
        if (!r.ok) return
        try {
          const list = (await r.json()) as SceneEntry[]
          if (Array.isArray(list) && list.length) {
            setAvailable(list)
          }
        } catch {
          // ignore
        }
      },
      () => undefined,
    )
  }, [])

  return <Ctx.Provider value={{ current, setCurrent, available }}>{children}</Ctx.Provider>
}

export function useCurrentScene(): SceneCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('SceneProvider missing')
  return v
}
