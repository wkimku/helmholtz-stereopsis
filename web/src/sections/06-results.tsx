import { Section } from '../components/Section'
import { ConfidenceFilterSlider } from '../components/ConfidenceFilterSlider'
import { useScene } from '../hooks/useScene'
import { sectionById } from './manifest'

const meta = sectionById('results')

export function Section06Results() {
  const { scene } = useScene()
  return (
    <Section id={meta.id} number={meta.number} title={meta.title} lede={meta.blurb}>
      <p>
        Running the depth search across every pixel and picking the
        cost-maximum at each one gives a depth map and a normal map for the
        viewpoint at the origin. Both come from the same eigendecomposition
        of <code>W(P)</code>, but they have very different noise behavior:
        the normal map is much cleaner than the depth map. The original paper
        notes the same thing, and the practical fix is to integrate the
        (clean) normal field into a smooth depth field via Frankot-Chellappa.
      </p>

      <figure className="my-8">
        <div className="rounded-lg border border-slate-200 bg-black/90 p-1">
          {scene && (
            <img
              src={`${scene.baseUrl}base_rgb.png`}
              alt="reference render"
              className="mx-auto block h-72 w-auto rounded object-contain"
            />
          )}
        </div>
        <figcaption className="figure-caption text-center">
          Reference render of the current scene (the procedural noise texture
          is essentially monochrome, which is why the rendering looks
          grayscale). The depth and normal maps below correspond to this
          viewpoint.
        </figcaption>
      </figure>

      <h3 className="mt-12 text-lg font-medium text-ink">Two knobs</h3>
      <p>
        The slider drops the bottom-N percent of foreground pixels by{' '}
        <code>σ₂/σ₁</code> confidence — at 0% you see the raw output, with
        noise where the constraint is unreliable; pushing it up trades coverage
        for cleanliness. The "smooth" toggle replaces the raw per-pixel depth
        with the Frankot-Chellappa integration of the normal map; the result
        is dramatically cleaner on the cube and the sphere, where most pixels
        share an obvious surface.
      </p>
      <ConfidenceFilterSlider />

      <p className="section-bridge">
        Next: the noise can also be fought from the other direction — by
        adding more reciprocal pairs.
      </p>
    </Section>
  )
}
