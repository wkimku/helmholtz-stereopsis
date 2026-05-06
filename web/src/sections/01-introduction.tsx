import { Section } from '../components/Section'
import { sectionById } from './manifest'

const meta = sectionById('intro')

export function Section01Introduction() {
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          You have a stack of photographs of an object and you want a 3D model.
          The standard tricks have a catch: classical stereo needs <em>texture</em>{' '}
          to find correspondences, and photometric stereo needs the surface to
          be <em>Lambertian</em>. Helmholtz Stereopsis drops both assumptions by
          exploiting a property the BRDF gives you for free: reciprocity.
        </>
      }
    >
      <p>
        This page walks through the algorithm one step at a time, on real
        renders. Most steps are interactive — you can change the number of
        reciprocal pairs, click a pixel and watch its depth-cost curve, rotate
        the recovered point cloud, and see the limitations of the method appear
        exactly where the original paper says they will. Three scenes are
        provided (Suzanne, a cube, and a sphere); switch between them with the
        picker in the header to compare the algorithm's behavior across
        geometries.
      </p>

      <div className="my-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ComparisonCard
          title="Conventional stereo"
          requires="Surface texture"
          fails="Smooth or repeating surfaces"
        />
        <ComparisonCard
          title="Photometric stereo"
          requires="Lambertian reflectance"
          fails="Glossy, metallic, or translucent objects"
        />
        <ComparisonCard
          title="Helmholtz stereopsis"
          requires="Reciprocal pair captures"
          fails="Heavily occluded or symmetric scenes"
          highlight
        />
      </div>

      <p>
        The math runs in Python; the visualizations run in your browser. Source
        code, the Blender data pipeline, and references to the original papers
        are linked at the end.
      </p>

      <p className="section-bridge">
        Next: the principle that makes the rest possible — Helmholtz reciprocity.
      </p>
    </Section>
  )
}

function ComparisonCard({
  title,
  requires,
  fails,
  highlight,
}: {
  title: string
  requires: string
  fails: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? 'border-accent/40 bg-accent/5'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="font-medium text-ink">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Requires</dt>
          <dd className="text-slate-800">{requires}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Struggles with</dt>
          <dd className="text-slate-800">{fails}</dd>
        </div>
      </dl>
    </div>
  )
}
