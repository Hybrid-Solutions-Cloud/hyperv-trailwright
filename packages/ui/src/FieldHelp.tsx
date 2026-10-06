import { useId, useState, type ReactNode } from 'react'
import './ui.css'

export interface FieldHelpProps {
  /** The field name. Kept out of the button's accessible name so label-based lookups find only the field itself; the input references the help text instead. */
  label: string
  /** Optional stable id for the help text, so the field's own input can reference it with aria-describedby. */
  id?: string
  children: ReactNode
}

/**
 * An "i" button that reveals help on hover, keyboard focus or tap. Escape closes it. The help text is
 * always linked to the button for screen readers, and takes no layout space while closed.
 */
export function FieldHelp({ label, id, children }: FieldHelpProps) {
  const generated = useId()
  const tipId = id ?? generated
  const [open, setOpen] = useState(false)
  return (
    <span className="cfg-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="cfg-help-button"
        aria-label="More information"
        data-field={label}
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={event => { event.preventDefault(); setOpen(value => !value) }}
        onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}
      >
        i
      </button>
      <span role="tooltip" id={tipId} className="cfg-help-tip" data-open={open || undefined}>
        {children}
      </span>
    </span>
  )
}
