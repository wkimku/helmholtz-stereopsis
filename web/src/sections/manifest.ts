// One source of truth for the table of contents and section anchors.
// Each entry's `id` is used as the URL hash and as the DOM id for scroll-spy.

export type SectionEntry = {
  id: string
  number: string
  title: string
  blurb: string
}

export const SECTIONS: SectionEntry[] = [
  { id: 'intro',         number: '01', title: 'Why Helmholtz Stereopsis?',         blurb: 'Reconstructing arbitrary BRDFs without texture or Lambertian assumptions.' },
  { id: 'reciprocity',   number: '02', title: 'The reciprocity principle',          blurb: 'BRDF symmetry under swapping light and view.' },
  { id: 'capture',       number: '03', title: 'Reciprocal pair capture',            blurb: 'How the image stack is acquired.' },
  { id: 'w-matrix',      number: '04', title: 'The W matrix and rank-2 search',     blurb: 'Turning reciprocity into a per-pixel constraint.' },
  { id: 'cost-curve',    number: '05', title: 'Cost vs depth — interactive',        blurb: 'Click any pixel and see why the depth peaks where it does.' },
  { id: 'results',       number: '06', title: 'Depth and normal maps',              blurb: 'The recovered surface for one viewpoint.' },
  { id: 'pairs-effect',  number: '07', title: 'Effect of the number of pairs',      blurb: 'How accuracy scales with N.' },
  { id: 'fusion',        number: '08', title: 'Multi-view fusion and final 3D',     blurb: 'Six axis-aligned passes fused into a single explorable point cloud.' },
  { id: 'limitations',   number: '09', title: 'Limitations and where it fails',     blurb: 'Depth ambiguity, occlusion, and discretization error.' },
  { id: 'sandbox',       number: '10', title: 'Try-it-yourself sandbox',            blurb: 'Run the full Blender pipeline locally with your own parameters.' },
]

/** Look up a section's metadata by its `id`. */
export function sectionById(id: string): SectionEntry {
  const s = SECTIONS.find((x) => x.id === id)
  if (!s) throw new Error(`unknown section id: ${id}`)
  return s
}
