import type { ReactNode } from 'react'

/**
 * Styled <details>/<summary> disclosure for optional depth (notation reference,
 * full derivations) that shouldn't clutter the main reading flow. Native
 * element → keyboard-accessible and works without JS.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="group my-6 rounded-xl border border-slate-200 bg-slate-50/60 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-slate-100">
        <svg
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7 5l6 5-6 5V5z" />
        </svg>
        {summary}
      </summary>
      <div className="border-t border-slate-200 px-4 py-4 text-sm text-slate-700">
        {children}
      </div>
    </details>
  )
}
