import { Section } from '../components/Section'
import { CostCurveExplorer } from '../components/CostCurveExplorer'
import { useCurrentScene } from '../data/SceneContext'
import { sectionById } from './manifest'

const meta = sectionById('cost-curve')

const TIPS: Record<string, string> = {
  cube:
    "Try clicking near a cube edge or corner (sharp peak) versus the middle of a flat face (smoother — sometimes ambiguous because the face has little local detail).",
  sphere:
    "Try clicking off-center on the sphere (sharp peak) versus the optical-axis center (the rotational symmetry of our circular capture rig produces a built-in ambiguity there).",
  suzanne:
    "Try clicking on the eye of Suzanne (textured, sharp peak) versus the flat forehead just above (smoother region, lower or flatter peak).",
}

export function Section05CostCurve() {
  const { current } = useCurrentScene()
  const tip = TIPS[current] ?? TIPS.suzanne
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          The most direct way to feel how the algorithm finds depth: pick any
          pixel on the base image and watch the ratio <code>σ₂/σ₁</code> as a
          function of candidate depth.
        </>
      }
    >
      <p>
        At the true depth the curve peaks sharply. A few false peaks at other
        depths are exactly the depth-ambiguity warning the original paper
        flags as the main failure mode — we'll come back to that in §9.
      </p>
      <p>{tip}</p>

      <CostCurveExplorer />

      <p className="section-bridge">
        Next: do this same search at every pixel simultaneously and you get a
        depth map for the whole image.
      </p>
    </Section>
  )
}
