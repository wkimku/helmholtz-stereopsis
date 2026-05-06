import { useEffect, useState } from 'react'
import { loadSceneMeta } from '../data/loader'
import type { LoadedScene } from '../data/types'
import { useCurrentScene } from '../data/SceneContext'

/** Loads the active scene's metadata (re-fetches when the user picks a different scene). */
export function useScene() {
  const { current } = useCurrentScene()
  const [scene, setScene] = useState<LoadedScene | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setScene(null)
    setError(null)
    let cancelled = false
    loadSceneMeta(current).then(
      (s) => {
        if (!cancelled) setScene(s)
      },
      (e) => {
        if (!cancelled) setError(String(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [current])

  return { scene, error, sceneName: current }
}
