import { useState } from 'react'

/**
 * §1 motivation figure (illustrative, not computed): photometric stereo assumes
 * Lambertian shading, so a specular highlight on a glossy surface is misread as
 * extra brightness → a wrong normal. Helmholtz stereopsis cancels the BRDF, so
 * the same highlight does not corrupt its estimate. Toggle the material to see
 * the highlight appear and the photometric-stereo estimate dent under it.
 */
export function PhotometricStereoTeaser() {
  const [glossy, setGlossy] = useState(true)

  return (
    <figure className="my-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Why the reflectance-free property matters</p>
        <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs">
          <button
            onClick={() => setGlossy(false)}
            className={`px-2.5 py-1 ${!glossy ? 'bg-accent text-white' : 'bg-white text-slate-600'}`}
          >
            matte
          </button>
          <button
            onClick={() => setGlossy(true)}
            className={`px-2.5 py-1 ${glossy ? 'bg-accent text-white' : 'bg-white text-slate-600'}`}
          >
            glossy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Panel title="Input photo">
          <InputSphere glossy={glossy} />
          <Caption>{glossy ? 'A bright specular highlight sits off-center.' : 'Smooth, matte falloff — no highlight.'}</Caption>
        </Panel>

        <Panel title="Photometric stereo" tone={glossy ? 'bad' : 'ok'}>
          <NormalSphere corruptAtHighlight={glossy} />
          <Caption tone={glossy ? 'bad' : 'ok'}>
            {glossy
              ? 'Assumes brightness = n̂·light. The highlight reads as a bump — wrong normals there.'
              : 'Lambertian assumption holds — normals are correct.'}
          </Caption>
        </Panel>

        <Panel title="Helmholtz stereopsis" tone="ok">
          <NormalSphere corruptAtHighlight={false} />
          <Caption tone="ok">The BRDF cancels out, so the highlight is irrelevant — correct either way.</Caption>
        </Panel>
      </div>

      <figcaption className="figure-caption mt-3">
        Schematic. The point: photometric stereo bakes in a reflectance model and
        breaks when the real surface violates it; Helmholtz stereopsis assumes no
        model at all.
      </figcaption>
    </figure>
  )
}

function Panel({ title, tone, children }: { title: string; tone?: 'ok' | 'bad'; children: React.ReactNode }) {
  const ring = tone === 'bad' ? 'ring-1 ring-rose-200' : tone === 'ok' ? 'ring-1 ring-emerald-200' : ''
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-2 ${ring}`}>
      <p className="mb-1 text-center text-xs font-medium text-slate-600">{title}</p>
      {children}
    </div>
  )
}

function Caption({ tone, children }: { tone?: 'ok' | 'bad'; children: React.ReactNode }) {
  const c = tone === 'bad' ? 'text-rose-600' : tone === 'ok' ? 'text-emerald-700' : 'text-slate-500'
  return <p className={`mt-1.5 text-[11px] leading-snug ${c}`}>{children}</p>
}

/** A shaded sphere (SVG). Glossy mode adds a small bright specular spot. */
function InputSphere({ glossy }: { glossy: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto block aspect-square w-full max-w-[160px]">
      <defs>
        <radialGradient id="lambert" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="55%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#111827" />
        </radialGradient>
        <radialGradient id="spec" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="48" fill="url(#lambert)" />
      {glossy && <ellipse cx="46" cy="42" rx="12" ry="9" fill="url(#spec)" />}
    </svg>
  )
}

/**
 * A hemisphere rendered in the classic normal-map coloring (x→R, y→G, z→B).
 * When `corruptAtHighlight` is set, the patch under the specular highlight is
 * distorted toward a false orientation to depict the photometric-stereo error.
 */
function NormalSphere({ corruptAtHighlight }: { corruptAtHighlight: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto block aspect-square w-full max-w-[160px]">
      <defs>
        {/* z-facing center (128,128,255 ≈ #8080ff) to tinted edges */}
        <radialGradient id="nmap" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8080ff" />
          <stop offset="70%" stopColor="#7a7ad8" />
          <stop offset="100%" stopColor="#4d4d80" />
        </radialGradient>
        <radialGradient id="nmapCorrupt" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c04070" />
          <stop offset="100%" stopColor="#c04070" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="48" fill="url(#nmap)" />
      {corruptAtHighlight && (
        <>
          <ellipse cx="46" cy="42" rx="13" ry="10" fill="url(#nmapCorrupt)" />
          <ellipse cx="46" cy="42" rx="13" ry="10" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3 2" />
        </>
      )}
    </svg>
  )
}
