import { Section } from '../components/Section'
import { PairsComparison } from '../components/PairsComparison'
import { sectionById } from './manifest'

const meta = sectionById('pairs-effect')

export function Section07PairsEffect() {
  return (
    <Section id={meta.id} number={meta.number} title={meta.title} lede={meta.blurb}>
      <p>
        The reciprocity constraint is necessary but not sufficient: a wrong
        depth can still satisfy a small number of reciprocal-pair rows by
        accident. Adding more pairs makes that less likely — a wrong depth
        would have to satisfy all of them simultaneously, which is much rarer.
      </p>
      <p>
        Below: the same scene reconstructed with <em>N</em> = 3, 6, 9, and 18
        reciprocal pairs. The N = 18 column (highlighted) is the cleanest; the
        N = 3 column is so noisy the surface is barely recognizable.
      </p>

      <PairsComparison />

      <p className="section-bridge">
        Next: the algorithm so far only sees one side of the object. To close
        the surface we need multiple capture sessions.
      </p>
    </Section>
  )
}
