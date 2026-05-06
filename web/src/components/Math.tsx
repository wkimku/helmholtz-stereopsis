import { BlockMath as KBlockMath, InlineMath as KInlineMath } from 'react-katex'

export function Inline({ children }: { children: string }) {
  return <KInlineMath math={children} />
}

export function Block({ children }: { children: string }) {
  return (
    <div className="my-6 overflow-x-auto">
      <KBlockMath math={children} />
    </div>
  )
}
