import { Section } from '../components/Section'
import { DepthAmbiguityExplorer } from '../components/DepthAmbiguityExplorer'
import { CrossSceneCompare } from '../components/CrossSceneCompare'
import { Disclosure } from '../components/Disclosure'
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

      <Disclosure summary="Compare the same pixel across all scenes">
        <p className="mb-3 text-slate-600">
          The amount of ambiguity at a given image location depends on the
          geometry underneath it. Load all three scenes and move the shared
          pixel to the center: the on-axis point is a clean peak on some
          geometries and multi-modal on others.
        </p>
        <CrossSceneCompare />
      </Disclosure>

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
        real <em>opaque</em> material), the algorithm is in scope. Two kinds of
        surface fall out of scope, for two different reasons: highly{' '}
        <em>translucent</em> ones break the single-bounce surface-reflection
        model the per-pixel constraint is derived from (light enters, scatters
        under the surface, and exits elsewhere), while <em>fluorescent</em>{' '}
        ones break Helmholtz reciprocity itself — they re-emit absorbed light at
        a different wavelength, so the reflectance is no longer symmetric under
        swapping the two directions.
      </p>

      <div className="my-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <p className="font-medium text-ink">The whole algorithm, in six lines</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Capture reciprocal pairs — two photos per pair with the camera and light swapped (§3).</li>
          <li>For a candidate surface point, read the two pixel intensities and build one row of the constraint matrix <code>W</code> (§4).</li>
          <li>Stack the rows from all pairs; the true depth is where <code>W</code> is closest to rank-2 (σ₁ → 0) (§4).</li>
          <li>Score each depth by σ₂/σ₁ and take the peak; the surface normal is <code>W</code>'s null vector (§5).</li>
          <li>Do that at every pixel for a depth + normal map; integrate the (cleaner) normals for smooth depth (§6).</li>
          <li>Fuse several viewpoints into one point cloud (§8). More pairs → less noise (§7); symmetry &amp; occlusion set the limits (§9).</li>
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          The one idea underneath all of it: reciprocity lets the BRDF cancel, so
          shape falls out without ever modeling reflectance.
        </p>
      </div>

      <p className="section-bridge">
        Next: try the full pipeline yourself — pick parameters, render in
        Blender, and watch the algorithm reconstruct your input live.
      </p>
    </Section>
  )
}
