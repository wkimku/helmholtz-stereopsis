import { Section } from '../components/Section'
import { FusionViewer } from '../components/FusionViewer'
import { sectionById } from './manifest'

const meta = sectionById('fusion')

export function Section08Fusion() {
  return (
    <Section id={meta.id} number={meta.number} title={meta.title} lede={meta.blurb}>
      <p>
        Each capture session sees only the side of the object facing the
        camera. To close the surface we render the object pre-rotated to each
        of the six axis-aligned faces (front, back, left, right, top, bottom),
        run the per-view depth search, and transform every partial point cloud
        back into a shared canonical frame:
      </p>
      <p className="text-sm text-slate-500">
        <code>P_canonical = R_view⁻¹ (P_world − T_view)</code>
      </p>
      <p>
        The viewer below is the merged result. Toggle individual views to see
        each capture session's contribution; switch the color mode to compare
        the algorithm's normal output with a per-view tint or a depth gradient;
        and adjust the point size to taste. Each per-view depth has already
        been smoothed by Frankot-Chellappa integration of its normal map, so
        the merged surface is much cleaner than the raw per-pixel depths
        would otherwise be.
      </p>

      <div className="figure-card">
        <FusionViewer />
      </div>

      <p className="section-bridge">
        Next: the cases where the algorithm fails — and what those failures
        teach about the method.
      </p>
    </Section>
  )
}
