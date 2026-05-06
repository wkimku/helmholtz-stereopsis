declare module 'react-katex' {
  import { ComponentType } from 'react'
  type Props = {
    math: string
    settings?: Record<string, unknown>
    renderError?: (e: Error) => React.ReactNode
  }
  export const InlineMath: ComponentType<Props>
  export const BlockMath: ComponentType<Props>
}
