/** A subtle "drag to orbit" pill for 3D canvas containers, so the orbit
 *  affordance isn't invisible until an accidental drag. Place inside a
 *  `relative` container. */
export function OrbitHint() {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
      drag to orbit · scroll to zoom
    </div>
  )
}
