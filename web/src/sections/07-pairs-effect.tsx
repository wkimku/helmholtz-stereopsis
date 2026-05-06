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
        Toggle between 3, 6, 9, and 18 pairs and watch the noise drop. The
        difference between 3 and 6 is dramatic; between 9 and 18 it's
        diminishing. In practice 9 pairs is a reasonable trade-off between
        capture time and result quality.
      </p>

      <PairsComparison />

      <p className="section-bridge">
        Next: the algorithm so far only sees one side of the object. To close
        the surface we need multiple capture sessions.
      </p>
    </Section>
  )
}
