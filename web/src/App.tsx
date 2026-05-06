import { Layout } from './components/Layout'
import { SceneProvider } from './data/SceneContext'
import { Section01Introduction } from './sections/01-introduction'
import { Section02Reciprocity } from './sections/02-reciprocity'
import { Section03PairCapture } from './sections/03-pair-capture'
import { Section04WMatrix } from './sections/04-w-matrix'
import { Section05CostCurve } from './sections/05-cost-curve'
import { Section06Results } from './sections/06-results'
import { Section07PairsEffect } from './sections/07-pairs-effect'
import { Section08Fusion } from './sections/08-fusion'
import { Section09Limitations } from './sections/09-limitations'
import { Section10Sandbox } from './sections/10-sandbox'

export default function App() {
  return (
    <SceneProvider>
      <Layout>
        <Section01Introduction />
        <Section02Reciprocity />
        <Section03PairCapture />
        <Section04WMatrix />
        <Section05CostCurve />
        <Section06Results />
        <Section07PairsEffect />
        <Section08Fusion />
        <Section09Limitations />
        <Section10Sandbox />
      </Layout>
    </SceneProvider>
  )
}
