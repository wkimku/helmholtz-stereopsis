import { Section } from '../components/Section'
import { DepthAmbiguityExplorer } from '../components/DepthAmbiguityExplorer'
import { sectionById } from './manifest'

const meta = sectionById('limitations')

export function Section09Limitations() {
  return (
    <Section id={meta.id} number={meta.number} title={meta.title} lede={meta.blurb}>
      <p>
        The reciprocity constraint is <em>necessary but not sufficient</em>:
        a wrong depth can satisfy the constraint by accident, especially in
        regions with little texture variation or where the camera/light
        layout is symmetric about the candidate point. The signature of that
        failure is a cost curve with multiple peaks of comparable height.
      </p>
      <p>
        Click two or more points on the image below — try a textured spot
        first, then somewhere flat or near the optical axis — and watch the
        curves. Switch scenes to see the same pattern across Suzanne, the
        cube, and the sphere; the on-axis sphere center is the most dramatic
        example of a built-in symmetric ambiguity.
      </p>

      <DepthAmbiguityExplorer />

      <p className="mt-8">Two more limitations show up across all three scenes:</p>
      <ul className="my-4 list-disc space-y-2 pl-5 text-slate-800">
        <li>
          <strong>Occlusion</strong>. The constraint requires both halves of a
          reciprocal pair to actually capture the same surface point. In a
          region where the surface is visible from one camera position in the
          pair but hidden from the other — concave dips around Suzanne's eye
          sockets, the inside corner of the cube — the second image samples
          some other surface entirely, so the corresponding row of{' '}
          <code>W</code> is corrupted and the rank score stops being meaningful.
        </li>
        <li>
          <strong>Discretization</strong>. Mapping a continuous scene through a
          pixel grid is inherently lossy, and rank is a notoriously sensitive
          measure of small perturbations. Finer depth grids and image
          resolution help, but only up to a point — and at some point you are
          just paying for noise to be averaged out.
        </li>
      </ul>
      <p>
        Despite all of this, the headline result is unchanged: this is one of
        the very few surface-reconstruction methods that makes <em>no</em>{' '}
        assumption about the surface BRDF. Mirror-like, glossy, anisotropic,
        even iridescent — as long as the reflectance is reciprocal (almost every
        real <em>opaque</em> material), the algorithm is in scope. Highly
        translucent or fluorescent surfaces are <em>not</em>: they violate the
        single-bounce surface-reflection model the per-pixel constraint is
        derived from.
      </p>

      <p className="section-bridge">
        Next: try the full pipeline yourself — pick parameters, render in
        Blender, and watch the algorithm reconstruct your input live.
      </p>
    </Section>
  )
}
