import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { dataUrl } from '../data/loader'
import { useScene } from '../hooks/useScene'
import { useCurrentScene } from '../data/SceneContext'
import { Skeleton } from './Skeleton'

const ADVANCE_INTERVAL_MS = 600
const RESUME_AFTER_INTERACT_MS = 3000

/**
 * §3 viewer: 3D scene of camera/light positions on a circle around the actual
 * object, plus the two captured images for the highlighted reciprocal pair.
 * The pair index advances automatically; dragging the slider pauses for a few
 * seconds before auto-advance resumes.
 */
export function PairCaptureViewer() {
  const { scene, error } = useScene()
  const { current: sceneName } = useCurrentScene()
  const [pair, setPair] = useState(0)
  const lastInteractedAt = useRef<number>(0)

  // Reset pair on scene change.
  useEffect(() => {
    setPair(0)
    lastInteractedAt.current = 0
  }, [sceneName])

  // Auto-advance unless the user just dragged the slider.
  useEffect(() => {
    if (!scene) return
    const N = scene.meta.num_pairs
    const id = setInterval(() => {
      const since = Date.now() - lastInteractedAt.current
      if (since < RESUME_AFTER_INTERACT_MS) return
      setPair((p) => (p + 1) % N)
    }, ADVANCE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [scene])

  if (error) {
    return <div className="text-sm text-red-500">Failed to load scene: {error}</div>
  }
  if (!scene) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton aspect="square" label="Loading scene…" />
        <Skeleton aspect="square" label="Loading 3D rig…" />
      </div>
    )
  }

  const N = scene.meta.num_pairs
  const cam = scene.meta.camera_positions
  const lit = scene.meta.light_positions
  const idxR = pair
  const idxL = pair + N
  // Object is rendered at this world location — match render.py's pose.
  const objectPos: [number, number, number] = [0, 0, 3]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <div className="aspect-square rounded-lg border border-slate-200 bg-slate-50">
          <Canvas camera={{ position: [0, 0.3, -3.5], fov: 35 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 5, 3]} intensity={0.7} />
            <gridHelper args={[6, 12]} />
            <axesHelper args={[1.2]} />

            <ObjectMesh sceneName={sceneName} position={objectPos} />

            {cam.map((p, i) => (
              <mesh key={`c-${i}`} position={p as [number, number, number]}>
                <sphereGeometry args={[i === idxR || i === idxL ? 0.07 : 0.035, 16, 16]} />
                <meshStandardMaterial
                  color={i === idxR ? '#6366f1' : i === idxL ? '#22d3ee' : '#cbd5e1'}
                  emissive={i === idxR || i === idxL ? '#1e1b4b' : '#000'}
                  emissiveIntensity={0.4}
                />
              </mesh>
            ))}
            {lit.map((p, i) => (
              <mesh key={`l-${i}`} position={p as [number, number, number]}>
                <sphereGeometry args={[i === idxR || i === idxL ? 0.07 : 0.03, 16, 16]} />
                <meshStandardMaterial
                  color={i === idxR ? '#fcd34d' : i === idxL ? '#f59e0b' : '#fef3c7'}
                  emissive={i === idxR || i === idxL ? '#78350f' : '#000'}
                  emissiveIntensity={0.5}
                />
              </mesh>
            ))}

            <OrbitControls
              makeDefault
              target={[0, 0, 3]}
              enablePan={false}
            />
          </Canvas>
        </div>
        <p className="figure-caption">
          Blue/cyan: cameras. Yellow/amber: lights. Highlighted spheres are the
          two captures of the current pair. The mesh in the middle is the
          actual object the algorithm is reconstructing.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <ImageTile
            url={`${scene.baseUrl}images/img_${String(idxR).padStart(2, '0')}.png`}
            label={`Image r — camera ${idxR}, light ${idxL}`}
          />
          <ImageTile
            url={`${scene.baseUrl}images/img_${String(idxL).padStart(2, '0')}.png`}
            label={`Image l — camera ${idxL}, light ${idxR}`}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Reciprocal pair (auto-advancing)</span>
            <span className="font-mono tabular-nums">{pair + 1} / {N}</span>
          </div>
          <input
            type="range"
            min={0}
            max={N - 1}
            value={pair}
            onChange={(e) => {
              setPair(Number(e.target.value))
              lastInteractedAt.current = Date.now()
            }}
            className="mt-2 w-full accent-accent"
          />
        </div>
      </div>
    </div>
  )
}

function ObjectMesh({ sceneName, position }: { sceneName: string; position: [number, number, number] }) {
  if (sceneName === 'cube') {
    return (
      <mesh position={position}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} metalness={0.05} />
      </mesh>
    )
  }
  if (sceneName === 'sphere') {
    return (
      <mesh position={position}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} metalness={0.05} />
      </mesh>
    )
  }
  return <SuzanneMesh position={position} />
}

function SuzanneMesh({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF(dataUrl('meshes/suzanne.glb'))
  const cloned = useMemo(() => {
    const root = gltf.scene.clone(true) as THREE.Object3D
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#cbd5e1',
          roughness: 0.7,
          metalness: 0.05,
        })
      }
    })
    return root
  }, [gltf])
  // Blender's Suzanne points its face along -Y; after the glTF coordinate
  // transform (Z-up → Y-up) the face ends up in the +Z direction, away from
  // the demo camera. Flip 180° around Y so the camera sees the face, not the
  // back of the head.
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, Math.PI, 0]}
    />
  )
}

useGLTF.preload(dataUrl('meshes/suzanne.glb'))

function ImageTile({ url, label }: { url: string; label: string }) {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    setOk(true)
  }, [url])
  return (
    <figure className="rounded-lg border border-slate-200 bg-black/90 p-1">
      {ok ? (
        <img
          src={url}
          className="aspect-square w-full rounded object-contain"
          alt={label}
          onError={() => setOk(false)}
        />
      ) : (
        <div className="aspect-square w-full rounded bg-slate-800 text-center text-xs text-slate-400">
          missing: {url}
        </div>
      )}
      <figcaption className="mt-2 text-center text-xs text-slate-600">{label}</figcaption>
    </figure>
  )
}
