import type { ReactNode } from 'react'
import { TableOfContents } from './TableOfContents'
import { SceneSelector } from './SceneSelector'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto flex max-w-7xl gap-12 px-6 py-12 md:py-16">
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
        <a href="#intro" className="font-mono text-sm tracking-tight text-ink">
          helmholtz<span className="text-accent">.demo</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Scene</span>
          <SceneSelector compact />
        </div>
      </div>
    </header>
  )
}

// (footer below)
function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-600">
      <div className="mx-auto max-w-3xl space-y-2 px-6">
        <p>
          An interactive walkthrough of Helmholtz Stereopsis (Zickler et al., 2002).
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
          </a>
          {' '}(O'Toole Group), Carnegie Mellon University. MIT licensed.
        </p>
      </div>
    </footer>
  )
}
