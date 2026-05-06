import { Section } from '../components/Section'
import { Block, Inline } from '../components/Math'
import { ReciprocityFigure } from '../components/ReciprocityFigure'
import { sectionById } from './manifest'

const meta = sectionById('reciprocity')

export function Section02Reciprocity() {
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          A surface's bidirectional reflectance distribution function (BRDF)
          describes how light arriving from one direction scatters back along
          another. The Helmholtz reciprocity principle says the function is
          symmetric — you can swap those two directions and get the same value.
        </>
      }
    >
      <Block>{`f_r(\\,\\hat{v}_l,\\;\\hat{v}_r\\,) \\;=\\; f_r(\\,\\hat{v}_r,\\;\\hat{v}_l\\,)`}</Block>
      <p>
        That's it. The BRDF <Inline>{`f_r`}</Inline> is unchanged when the
        two directions are interchanged. Concretely: take a photograph with
        the camera at <Inline>{`A`}</Inline> and the light at{' '}
        <Inline>{`B`}</Inline>, then a second photograph with their positions{' '}
        <em>swapped</em>. The intensities at the same surface point in the two
        images are linked by a relationship that does not depend on which BRDF
        the material has — only on geometry and the two intensities themselves.
      </p>

      <p>
        Following Zickler's notation, <Inline>{`\\hat v_l`}</Inline> and{' '}
        <Inline>{`\\hat v_r`}</Inline> are unit vectors from the surface
        point <Inline>{`P`}</Inline> toward two <em>fixed</em> positions{' '}
        <Inline>{`O_l = A`}</Inline> and <Inline>{`O_r = B`}</Inline>. They are
        pure geometry: the vectors don't change between the two captures. What
        changes is only which device — camera or light — sits at each position.
      </p>

      <ReciprocityFigure />
      <p className="figure-caption">
        The vectors <Inline>{`\\hat v_l`}</Inline> and{' '}
        <Inline>{`\\hat v_r`}</Inline> stay fixed; only the colored marker at
        each position swaps role between camera (indigo) and light (amber).
      </p>

      <p>
        Reciprocity holds for almost every real material — diffuse paint,
        metallic, translucent, glossy plastics — because it is a consequence of
        the second law of thermodynamics applied to light transport. There are
        a handful of exceptions (fluorescent and phosphorescent surfaces,
        polarization-dependent reflectance), and outside those it is a free
        constraint that no other surface-reconstruction method exploits.
      </p>

      <p className="section-bridge">
        Next: turn this principle into something we can actually capture with
        a camera.
      </p>
    </Section>
  )
}
