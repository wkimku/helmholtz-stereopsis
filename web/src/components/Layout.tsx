import { useState, type ReactNode } from 'react'
import { TableOfContents } from './TableOfContents'
import { SceneSelector } from './SceneSelector'
import { ScrollProgress } from './ScrollProgress'
import { SECTIONS } from '../sections/manifest'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Masthead />
      <div className="mx-auto flex max-w-7xl gap-12 px-6 pb-12 md:pb-16">
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 lg:block">
          <TableOfContents />
          <div className="mt-8">
            <SceneSelector />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <a href="#top" className="font-mono text-sm tracking-tight text-ink">
          helmholtz<span className="text-accent">.demo</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Scene (applies to every section)</span>
          <span className="sm:hidden">Scene</span>
          <SceneSelector compact />
        </div>
      </div>
      <MobileContents />
      <ScrollProgress />
    </header>
  )
}

/** Page title band. The document's single H1 — without a hero image the opening
 *  still needs a real masthead rather than starting on a section eyebrow. */
function Masthead() {
  return (
    <div id="top" className="border-b border-slate-200 bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Interactive walkthrough
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Helmholtz Stereopsis
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          Recovering 3D shape for surfaces with <em>any</em> reflectance — matte,
          glossy, even mirror-like — by exploiting the reciprocity of the BRDF.
          Ten steps, on real renders, most of them interactive.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Built by the{' '}
          <a
            href="https://www.cs.cmu.edu/~motoole2/"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Light Transport Lab
          </a>{' '}
          (O'Toole Group), Carnegie Mellon University.
        </p>
      </div>
    </div>
  )
}

/** Collapsible section list for screens below the lg sidebar breakpoint. */
function MobileContents() {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="border-t border-slate-200/60 lg:hidden"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="mx-auto flex max-w-7xl cursor-pointer list-none items-center gap-2 px-6 py-2 text-xs font-medium text-slate-600">
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7 5l6 5-6 5V5z" />
        </svg>
        Contents
      </summary>
      <ol className="mx-auto max-w-7xl px-6 pb-3 text-sm">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={() => setOpen(false)}
              className="flex items-baseline gap-3 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink"
            >
              <span className="font-mono text-[11px] tabular-nums text-slate-500">{s.number}</span>
              <span>{s.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  )
}

function Footer() {
  const bibtex = `@inproceedings{zickler2002helmholtz,
  title     = {Helmholtz Stereopsis: Exploiting Reciprocity for Surface Reconstruction},
  author    = {Zickler, Todd and Belhumeur, Peter N. and Kriegman, David J.},
  booktitle = {European Conference on Computer Vision (ECCV)},
  pages     = {869--884},
  year      = {2002},
}`
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-2">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            An interactive walkthrough of Helmholtz Stereopsis (Zickler,
            Belhumeur &amp; Kriegman, ECCV 2002).
          </p>
          <p>
            Built by the{' '}
            <a
              href="https://www.cs.cmu.edu/~motoole2/"
              className="text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Light Transport Lab
            </a>{' '}
            (O'Toole Group), Carnegie Mellon University. Code &amp; data pipeline
            are MIT-licensed.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href="https://github.com/wkimku/helmholtz-stereopsis"
              className="text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repository
            </a>
            <a
              href="https://doi.org/10.1007/3-540-47977-5_57"
              className="text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Original paper (DOI)
            </a>
          </p>
        </div>
        <CiteBox bibtex={bibtex} />
      </div>
    </footer>
  )
}

function CiteBox({ bibtex }: { bibtex: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cite the paper</p>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(bibtex).then(
              () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              },
              () => undefined,
            )
          }}
          className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300"
        >
          {copied ? 'Copied' : 'Copy BibTeX'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-snug text-slate-700">
        {bibtex}
      </pre>
    </div>
  )
}
