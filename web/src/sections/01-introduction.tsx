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
          Try to 3D-scan a polished steel ball, a chrome car part, or a glossy
          black ceramic teapot with the usual computer-vision tricks and you
          will fail. Classical stereo needs surface texture; photometric stereo
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

      <h3 className="mt-10 text-lg font-medium text-ink">
        Where it sits among shape-recovery methods
      </h3>
      <p>
        Every passive shape-from-images method buys its geometry with some
        assumption about the scene. What makes Helmholtz Stereopsis unusual is
        the one it <em>doesn't</em> make — it never models the reflectance.
      </p>
      <MethodComparison />

      <p>
        The catch is in the last column: HS needs the pixel intensity to
        actually <em>change</em> across the reciprocal pairs, which comes from
        surface curvature or from albedo variation. Perfectly flat, uniform
        regions viewed symmetrically stay ambiguous — the failure mode we make
        interactive in §9.
      </p>

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

type Row = {
  method: string
  brdf: string
  cue: string
  specular: 'yes' | 'no' | 'partial'
  highlight?: boolean
}

const ROWS: Row[] = [
  {
    method: 'Classical / multi-view stereo',
    brdf: 'None, but assumes brightness constancy',
    cue: 'Texture / correspondences',
    specular: 'no',
  },
  {
    method: 'Photometric stereo',
    brdf: 'Lambertian (or a known model)',
    cue: 'Shading under known lights',
    specular: 'no',
  },
  {
    method: 'Structured light',
    brdf: 'None (projects its own pattern)',
    cue: 'Deformation of a known pattern',
    specular: 'no',
  },
  {
    method: 'Neural rendering (NeRF / 3DGS)',
    brdf: 'Implicit, entangled with geometry',
    cue: 'Many calibrated views',
    specular: 'partial',
  },
  {
    method: 'Helmholtz stereopsis',
    brdf: 'None — any reciprocal BRDF',
    cue: 'Reciprocal pair captures',
    specular: 'yes',
    highlight: true,
  },
]

const MARK: Record<Row['specular'], { glyph: string; cls: string; label: string }> = {
  yes: { glyph: '✓', cls: 'text-emerald-600', label: 'handles specular/mirror surfaces' },
  no: { glyph: '✕', cls: 'text-rose-500', label: 'fails on specular/mirror surfaces' },
  partial: { glyph: '~', cls: 'text-amber-500', label: 'partial: geometry entangled with appearance' },
}

function MethodComparison() {
  return (
    <figure className="my-8 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 pr-4 font-medium">Method</th>
            <th className="py-2 pr-4 font-medium">Reflectance assumption</th>
            <th className="py-2 pr-4 font-medium">Primary cue</th>
            <th className="py-2 pr-2 text-center font-medium">Mirror / glossy?</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const m = MARK[r.specular]
            return (
              <tr
                key={r.method}
                className={`border-b border-slate-200 ${
                  r.highlight ? 'bg-accent/5' : ''
                }`}
              >
                <td className={`py-2 pr-4 ${r.highlight ? 'font-semibold text-ink' : 'text-ink'}`}>
                  {r.method}
                </td>
                <td className="py-2 pr-4 text-slate-700">{r.brdf}</td>
                <td className="py-2 pr-4 text-slate-700">{r.cue}</td>
                <td className={`py-2 pr-2 text-center text-base font-bold ${m.cls}`} title={m.label}>
                  {m.glyph}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <figcaption className="figure-caption mt-2">
        The last column is reconstruction of shiny, mirror-like, or metallic
        surfaces — where reflectance defeats the correspondence and
        Lambertian-shading cues. Only Helmholtz stereopsis handles it
        outright, because it cancels the BRDF instead of assuming one.
      </figcaption>
    </figure>
  )
}
