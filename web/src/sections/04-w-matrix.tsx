import { Section } from '../components/Section'
import { Block, Inline } from '../components/Math'
import { WMatrixFigure } from '../components/WMatrixFigure'
import { sectionById } from './manifest'

const meta = sectionById('w-matrix')

export function Section04WMatrix() {
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          Combine the rendering equation for both halves of a reciprocal pair
          with the BRDF symmetry from §2 and the BRDF cancels out. What remains
          is a per-pixel linear constraint on the surface normal at the true
          depth.
        </>
      }
    >
      <Block>{`\\bigl[\\,I_r\\,\\frac{\\nu_l}{\\|\\nu_l\\|^3}\\;-\\;I_l\\,\\frac{\\nu_r}{\\|\\nu_r\\|^3}\\,\\bigr]\\cdot\\hat n \\;=\\; 0`}</Block>
      <p>
        Here <Inline>{`\\nu_l = O_l - P`}</Inline> and{' '}
        <Inline>{`\\nu_r = O_r - P`}</Inline> are the un-normalized vectors
        from the surface point to the two reciprocal positions (so{' '}
        <Inline>{`\\hat v_l = \\nu_l / \\|\\nu_l\\|`}</Inline>), and{' '}
        <Inline>{`I_l, I_r`}</Inline> are the pixel intensities of the two
        captures at the projection of <Inline>{`P`}</Inline>.
      </p>

      <p>
        Each reciprocal pair contributes one such row vector. Stack <em>N</em>{' '}
        rows into a matrix <code>W(P)</code> evaluated at a candidate surface
        point <code>P</code>. At the <em>true</em> depth every row evaluates to
        a vector perpendicular to the same normal, so all rows lie in a 2D
        plane and <code>W(P)</code> is rank-2. The unit normal{' '}
        <Inline>{`\\hat n`}</Inline> is the right singular vector corresponding
        to the smallest singular value — the null space of <code>W</code>.
      </p>

      <p>
        The algorithm searches over candidate depths along each camera ray and
        picks the depth at which <code>W</code> is closest to rank-deficient.
        Ordering the singular values smallest first as{' '}
        <Inline>{`\\sigma_1 \\le \\sigma_2 \\le \\sigma_3`}</Inline>, the score
        is the ratio <Inline>{`\\sigma_2 / \\sigma_1`}</Inline>, which goes to
        infinity exactly when <Inline>{`\\sigma_1`}</Inline> drops to zero —
        i.e. when <code>W</code> is rank-2. (The original paper uses descending
        order and writes the same ratio as <Inline>{`\\sigma_2 / \\sigma_3`}</Inline>.)
      </p>

      <WMatrixFigure />
      <p className="figure-caption">
        Real singular values of <code>W(P)</code> at a clicked pixel as the
        candidate depth sweeps along the camera ray. At the true depth{' '}
        <Inline>{`\\sigma_1`}</Inline> dips toward zero and the matrix becomes
        (approximately) rank-2; <Inline>{`\\sigma_2`}</Inline> and{' '}
        <Inline>{`\\sigma_3`}</Inline> stay non-zero. Click around — textured
        regions give a sharp dip; flat or symmetric regions give shallow or
        multi-modal curves (we'll come back to that in §9).
      </p>

      <p className="section-bridge">
        Next: pick a real pixel and watch <Inline>{`\\sigma_2 / \\sigma_1`}</Inline>{' '}
        rise toward its peak as the candidate depth approaches the right value.
      </p>
    </Section>
  )
}
