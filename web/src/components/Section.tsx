import type { ReactNode } from 'react'
import { SECTIONS } from '../sections/manifest'

type Props = {
  id: string
  number: string
  title: string
  lede?: ReactNode
  children?: ReactNode
}

export function Section({ id, number, title, lede, children }: Props) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-slate-200 py-16 md:py-24">
      <div className="mx-auto max-w-prose2">
        <p className="section-eyebrow">
          Step {number} / {String(SECTIONS.length).padStart(2, '0')}
        </p>
        <h2 className="section-h2">{title}</h2>
        {lede && <p className="section-lede">{lede}</p>}
      </div>
      <div className="section-body mx-auto mt-8 max-w-prose2">{children}</div>
    </section>
  )
}
