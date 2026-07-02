import { Section } from '../components/Section'
import { PairCaptureViewer } from '../components/PairCaptureViewer'
import { sectionById } from './manifest'

const meta = sectionById('capture')

export function Section03PairCapture() {
  return (
    <Section
      id={meta.id}
      number={meta.number}
      title={meta.title}
      lede={
        <>
          To exploit reciprocity we need <em>reciprocal pair</em> captures: two
          photographs where the camera and the light source have been physically
          swapped. The capture rig is the simplest part of the algorithm.
        </>
      }
    >
      <p>
        For this demo a single object sits in front of the camera while a
        camera/light pair sweeps around it on a circle. We take{' '}
        <em>2N</em> images from <em>2N</em> evenly spaced positions on that
        circle — one capture per position — and pair each capture with the one
        taken from the antipodal position. Because the camera and light always
        sit on opposite sides of the circle, the two captures of a pair already
        have their camera and light swapped: forming a reciprocal pair is just
        a re-indexing, no extra calibration required.
      </p>

      <div className="figure-card">
        <PairCaptureViewer />
        <p className="figure-caption">
          Drag the 3D scene to orbit. The slider selects a reciprocal pair —
          the two highlighted blue/cyan spheres mark where the camera sat for
          the pair's two captures, and the two highlighted yellow/amber
          spheres mark the corresponding light positions. The two thumbnails
          are the actual rendered images for that pair.
        </p>
      </div>

      <p>
        The two intensities you see in each pair are not arbitrary numbers.
        Each one is a sample of the same surface BRDF evaluated in opposite
        directions — and reciprocity says those two BRDF evaluations are
        equal. That single algebraic identity, applied per-pixel and combined
        with the rendering equation, is what turns a stack of photographs into
        a 3D shape.
      </p>

      <p className="section-bridge">
        Next: build the per-pixel constraint that does the work.
      </p>
    </Section>
  )
}
