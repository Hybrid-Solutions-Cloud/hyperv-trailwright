import type { ReactNode } from 'react'
import './ui.css'

export interface SectionIntroProps {
  /** One or two plain sentences: what this section decides and why it matters. */
  purpose: ReactNode
  /** What the engineer should have in hand before starting the section. */
  needs?: ReactNode[]
}

/** Opens a section with its purpose and a short checklist of what to have ready. */
export function SectionIntro({ purpose, needs = [] }: SectionIntroProps) {
  return (
    <div className="cfg-section-intro">
      <p>{purpose}</p>
      {needs.length > 0 && (
        <>
          <p><strong>Have ready:</strong></p>
          <ul>{needs.map((need, index) => <li key={index}>{need}</li>)}</ul>
        </>
      )}
    </div>
  )
}
