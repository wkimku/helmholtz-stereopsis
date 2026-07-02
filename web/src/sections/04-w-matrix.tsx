import { Section } from '../components/Section'
import { Block, Inline } from '../components/Math'
import { WMatrixFigure } from '../components/WMatrixFigure'
import { Disclosure } from '../components/Disclosure'
import { sectionById } from './manifest'

const meta = sectionById('w-matrix')

function NotationBox() {
  const rows: [string, string][] = [
    [`P`, 'A candidate surface point being tested along the camera ray.'],
    [`O_l,\\; O_r`, 'The two fixed capture positions from §2 (left / right of the rig).'],
    [`\\nu_l,\\; \\nu_r`, 'Un-normalized vectors from P toward each position: ν = O − P.'],
    [`\\hat v_l,\\; \\hat v_r`, 'The same vectors normalized to unit length (ν / ‖ν‖).'],
    [`I_l,\\; I_r`, 'Pixel intensities of the two captures at the projection of P. I couples with the direction to its own camera.'],
    [`W(P)`, 'The N×3 constraint matrix — one reciprocal-pair row each.'],
    [`\\sigma_1 \\le \\sigma_2 \\le \\sigma_3`, 'Singular values of W, ascending. σ₁ → 0 means rank-2.'],
    [`\\hat n`, 'Surface normal — the null vector of W (right singular vector of σ₁).'],
  ]
  return (
    <Disclosure summary="Notation reference (ν, W, σ, n̂)">
      <dl className="space-y-2">
        {rows.map(([sym, desc]) => (
          <div key={sym} className="grid grid-cols-[7rem_1fr] items-baseline gap-3">
            <dt className="font-mono">
              <Inline>{sym}</Inline>
            </dt>
            <dd className="text-slate-600">{desc}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  )
}

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
      <p>
        Before the algebra, the shape of the answer. We don't know the surface's
        reflectance, and we don't want to. So instead of trying to{' '}
        <em>predict</em> a pixel's brightness, we write down a relationship
        between the two brightnesses of a reciprocal pair that stays true{' '}
        <em>whatever</em> the reflectance is — the BRDF appears on both sides and
        cancels. What survives is purely geometric: a single equation that the
        surface normal <Inline>{`\\hat n`}</Inline> must satisfy at the true
        depth. It is linear in <Inline>{`\\hat n`}</Inline>, so each reciprocal
        pair pins the normal down a little more.
      </p>

      <Block>{`\\bigl[\\,I_l\\,\\frac{\\nu_l}{\\|\\nu_l\\|^3}\\;-\\;I_r\\,\\frac{\\nu_r}{\\|\\nu_r\\|^3}\\,\\bigr]\\cdot\\hat n \\;=\\; 0`}</Block>
      <p>
        Here <Inline>{`\\nu_l = O_l - P`}</Inline> and{' '}
        <Inline>{`\\nu_r = O_r - P`}</Inline> are the un-normalized vectors from
        the surface point <Inline>{`P`}</Inline> toward the two fixed positions{' '}
        <Inline>{`O_l, O_r`}</Inline> from §2 (so{' '}
        <Inline>{`\\hat v_l = \\nu_l / \\|\\nu_l\\|`}</Inline>).{' '}
        <Inline>{`I_l`}</Inline> is the intensity of the capture whose{' '}
        <em>camera</em> sits at <Inline>{`O_l`}</Inline> (lit from{' '}
        <Inline>{`O_r`}</Inline>), and <Inline>{`I_r`}</Inline> the intensity of
        the swapped capture (camera at <Inline>{`O_r`}</Inline>, lit from{' '}
        <Inline>{`O_l`}</Inline>), both read at the projection of{' '}
        <Inline>{`P`}</Inline>. Each intensity multiplies the direction toward
        its own camera — that pairing is exactly what falls out of eliminating
        the reciprocal BRDF between the two rendering equations.
      </p>

      <NotationBox />

      <Disclosure summary="Where this constraint comes from (full derivation)">
        <p>
          Write the image-formation equation for both captures of the pair. With
          a point light, the intensity at the projection of{' '}
          <Inline>{`P`}</Inline> is the BRDF times the foreshortened irradiance
          from the light, which falls off with the inverse square of the
          light-to-surface distance:
        </p>
        <Block>{`I_l = f_r(\\hat v_r, \\hat v_l)\\,\\frac{\\hat n \\cdot \\hat v_r}{\\|\\nu_r\\|^2}, \\qquad I_r = f_r(\\hat v_l, \\hat v_r)\\,\\frac{\\hat n \\cdot \\hat v_l}{\\|\\nu_l\\|^2}`}</Block>
        <p>
          In capture <Inline>{`l`}</Inline> the camera is at{' '}
          <Inline>{`O_l`}</Inline> and the light at <Inline>{`O_r`}</Inline>, so
          the incoming direction is <Inline>{`\\hat v_r`}</Inline> and the
          outgoing (view) direction is <Inline>{`\\hat v_l`}</Inline>; capture{' '}
          <Inline>{`r`}</Inline> swaps them. Helmholtz reciprocity says the two
          BRDF evaluations are equal:
        </p>
        <Block>{`f_r(\\hat v_r, \\hat v_l) = f_r(\\hat v_l, \\hat v_r)`}</Block>
        <p>
          So form the ratio-free combination that cancels the (unknown) BRDF —
          divide out <Inline>{`f_r`}</Inline> from both and cross-multiply:
        </p>
        <Block>{`I_l\\,\\frac{\\|\\nu_l\\|^2}{\\hat n \\cdot \\hat v_l} = I_r\\,\\frac{\\|\\nu_r\\|^2}{\\hat n \\cdot \\hat v_r} \\;\\Longrightarrow\\; I_l\\,\\frac{\\hat n \\cdot \\hat v_r}{\\|\\nu_r\\|^2} - I_r\\,\\frac{\\hat n \\cdot \\hat v_l}{\\|\\nu_l\\|^2} = 0`}</Block>
        <p>
          Using <Inline>{`\\hat v = \\nu / \\|\\nu\\|`}</Inline> to fold the
          normalization into the cube of the norm, and pulling the shared{' '}
          <Inline>{`\\hat n`}</Inline> out of the dot products, this is exactly
          the per-pixel constraint at the top of the section:
        </p>
        <Block>{`\\bigl[\\,I_l\\,\\tfrac{\\nu_l}{\\|\\nu_l\\|^3} - I_r\\,\\tfrac{\\nu_r}{\\|\\nu_r\\|^3}\\,\\bigr]\\cdot\\hat n = 0`}</Block>
        <p className="text-slate-500">
          Nothing here assumes a particular reflectance — the BRDF divided out
          before we ever needed to know its form. That is the whole trick.
        </p>
      </Disclosure>

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
        The algorithm searches over candidate depths — sweeping{' '}
        <Inline>{`z`}</Inline> at each fixed image-plane{' '}
        <Inline>{`(x, y)`}</Inline> — and picks the depth at which{' '}
        <code>W</code> is closest to rank-deficient. Ordering the singular
        values smallest first as{' '}
        <Inline>{`\\sigma_1 \\le \\sigma_2 \\le \\sigma_3`}</Inline>, the score
        is the ratio <Inline>{`\\sigma_2 / \\sigma_1`}</Inline>, which goes to
        infinity exactly when <Inline>{`\\sigma_1`}</Inline> drops to zero —
        i.e. when <code>W</code> is rank-2. (The original paper uses descending
        order and writes the same ratio as <Inline>{`\\sigma_2 / \\sigma_3`}</Inline>.)
      </p>

      <WMatrixFigure />
      <p className="figure-caption">
        Real singular values of <code>W(P)</code> at a clicked pixel as the
        candidate depth <Inline>{`z`}</Inline> sweeps through the scene. At the
        true depth{' '}
        <Inline>{`\\sigma_1`}</Inline> dips toward zero and the matrix becomes
        (approximately) rank-2; <Inline>{`\\sigma_2`}</Inline> and{' '}
        <Inline>{`\\sigma_3`}</Inline> stay non-zero. Click around — textured
        regions give a sharp dip; flat or symmetric regions give shallow or
        multi-modal curves (we'll come back to that in §9). The marked peak of{' '}
        <Inline>{`\\sigma_2/\\sigma_1`}</Inline> is the depth this pixel
        resolves to.
      </p>

      <p className="section-bridge">
        Next: pick a real pixel and watch <Inline>{`\\sigma_2 / \\sigma_1`}</Inline>{' '}
        rise toward its peak as the candidate depth approaches the right value.
      </p>
    </Section>
  )
}
