import { useMemo } from 'react'
import katex from 'katex'

/**
 * Thin wrappers around `katex.renderToString`. We bypass `react-katex`
 * because some prop-handling paths there mangle macro expansions of `\,`
 * and friends in production builds.
 */

export function Inline({ children }: { children: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: false, throwOnError: false }),
    [children],
  )
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export function Block({ children }: { children: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: true, throwOnError: false }),
    [children],
  )
  return (
    <div
      className="my-6 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
