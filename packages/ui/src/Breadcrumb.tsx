import './ui.css'

export interface Crumb {
  label: string
  /** Omit for the current page. */
  href?: string
}

export interface BreadcrumbProps {
  /** From the catalog down to the current page; the last item is the current page. */
  items: Crumb[]
}

/** The same trail on the catalog, the documentation pages and every tool: Configurators › Tool › Page. */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="cfg-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`}>
              {current || !item.href
                ? <span aria-current={current ? 'page' : undefined}>{item.label}</span>
                : <a href={item.href}>{item.label}</a>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
