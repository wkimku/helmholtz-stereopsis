import { Suspense, lazy } from 'react'
import { Layout } from './components/Layout'
import { SceneProvider } from './data/SceneContext'
import { Section01Introduction } from './sections/01-introduction'
import { Section02Reciprocity } from './sections/02-reciprocity'
import { Section04WMatrix } from './sections/04-w-matrix'
import { Section05CostCurve } from './sections/05-cost-curve'
import { Section06Results } from './sections/06-results'
import { Section07PairsEffect } from './sections/07-pairs-effect'
import { Section09Limitations } from './sections/09-limitations'

// Lazy-load the three.js-heavy sections (§3 pair capture viewer, §8 fusion
// point cloud, §10 sandbox) so the initial bundle stays small. They each pull
// in three + @react-three/drei + drei loaders, which together are ~1 MB.
const Section03PairCapture = lazy(() =>
  import('./sections/03-pair-capture').then((m) => ({ default: m.Section03PairCapture })),
)
const Section08Fusion = lazy(() =>
  import('./sections/08-fusion').then((m) => ({ default: m.Section08Fusion })),
)
const Section10Sandbox = lazy(() =>
  import('./sections/10-sandbox').then((m) => ({ default: m.Section10Sandbox })),
)

function SectionFallback({ id, label }: { id: string; label: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-slate-200 py-16 md:py-24">
      <div className="mx-auto max-w-prose2 text-sm text-slate-500">
        Loading {label}…
      </div>
    </section>
  )
}

export default function App() {
  return (
    <SceneProvider>
      <Layout>
        <Section01Introduction />
        <Section02Reciprocity />
        <Suspense fallback={<SectionFallback id="capture" label="pair capture viewer" />}>
          <Section03PairCapture />
        </Suspense>
        <Section04WMatrix />
        <Section05CostCurve />
        <Section06Results />
        <Section07PairsEffect />
        <Suspense fallback={<SectionFallback id="fusion" label="fusion 3D view" />}>
          <Section08Fusion />
        </Suspense>
        <Section09Limitations />
        <Suspense fallback={<SectionFallback id="sandbox" label="sandbox" />}>
          <Section10Sandbox />
        </Suspense>
      </Layout>
    </SceneProvider>
  )
}
