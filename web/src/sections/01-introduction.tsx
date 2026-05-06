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
          Try to 3D-scan a glass marble, a polished steel ball, or a glossy
          ceramic teapot with the usual computer-vision tricks and you will
          fail. Classical stereo needs surface texture; photometric stereo
          assumes the object reflects light like chalk. Helmholtz Stereopsis
          drops both assumptions and works on any opaque surface — matte,
          glossy, even mirror-like — by exploiting one symmetry every physical
          BRDF satisfies for free.
        </>
      }
    >
      <p>
        This page walks through the algorithm one step at a time, on real
        renders. Every step is interactive: pick the number of reciprocal pairs
        to capture, click a pixel and watch its depth-cost curve, rotate the
        recovered point cloud, and see the limitations of the method appear
        exactly where the original paper says they will. Three scenes are
        provided (Suzanne, a cube, and a sphere); switch between them with the
        picker in the header to compare the algorithm's behavior across
        geometries.
      </p>

      <div className="my-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ComparisonCard
          title="Classical stereo"
          requires="Surface texture"
          fails="Smooth or repeating surfaces"
        />
        <ComparisonCard
          title="Photometric stereo"
          requires="Lambertian reflectance"
          fails="Glossy, metallic, or anisotropic objects"
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
        are linked at the end. There is also a try-it-yourself sandbox in §10
        if you want to render your own object and watch the full pipeline run
        end-to-end.
      </p>

      <p className="section-bridge">
        Next: the symmetry that makes everything else possible — Helmholtz
        reciprocity.
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
