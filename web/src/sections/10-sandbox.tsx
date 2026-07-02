import { Section } from '../components/Section'
import { SandboxSection } from '../components/SandboxSection'
import { sectionById } from './manifest'

const meta = sectionById('sandbox')

export function Section10Sandbox() {
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          Everything up to here is precomputed. If you want to actually push
          the algorithm — different objects, materials, noise levels, depth
          resolutions — clone the{' '}
          <a
            href="https://github.com/wkimku/helmholtz-stereopsis"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            repo
          </a>
          , install Blender, and run the local pipeline server. This section
          then becomes live: the controls below fire off real Blender renders
          and depth-search runs on your machine, and the results stream back.
        </>
      }
    >
      <p>
        The button polls <code>http://127.0.0.1:8765/api/health</code>{' '}
        every five seconds. While the server is unreachable the controls stay
        disabled and a setup snippet is shown. As soon as the server starts up
        the section turns green and you can run the pipeline end to end —
        Blender renders the reciprocal pairs, NumPy/SciPy solves depth and
        normal, Open3D merges, and the resulting depth map, normal map, and
        point cloud appear inline.
      </p>

      <SandboxSection />

      <p className="mt-8 text-xs text-slate-500">
        See{' '}
        <a
          href="https://github.com/wkimku/helmholtz-stereopsis/blob/main/sandbox/README.md"
          className="text-accent hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          <code>sandbox/README.md</code>
        </a>{' '}
        in the repo for the install steps and parameter notes.
      </p>

      <div className="my-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="font-medium text-ink">Read the original</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Zickler, Belhumeur, and Kriegman.{' '}
              <a href="https://doi.org/10.1007/3-540-47977-5_57" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                <em>Helmholtz Stereopsis: Exploiting Reciprocity for Surface Reconstruction.</em>
              </a>{' '}
              ECCV 2002.
            </li>
            <li>
              Zickler.{' '}
              <a href="https://doi.org/10.1007/11744047_60" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                <em>Reciprocal Image Features for Uncalibrated Helmholtz Stereopsis.</em>
              </a>{' '}
              CVPR 2006.
            </li>
            <li>
              Frankot and Chellappa.{' '}
              <a href="https://doi.org/10.1109/34.3909" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                <em>A Method for Enforcing Integrability in Shape from Shading Algorithms.</em>
              </a>{' '}
              IEEE TPAMI 1988. (used by §6 to integrate normals into a smooth depth)
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="font-medium text-ink">About this demo</p>
          <p className="mt-3 text-sm text-slate-700">
            Built by the{' '}
            <a
              href="https://www.cs.cmu.edu/~motoole2/"
              className="text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Light Transport Lab
            </a>{' '}
            (O'Toole Group) at Carnegie Mellon University as a teaching aid for
            students entering computational imaging and inverse-rendering
            research. Code and data pipeline are MIT-licensed.
          </p>
        </div>
      </div>
    </Section>
  )
}
