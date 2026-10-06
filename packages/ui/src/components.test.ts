import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Breadcrumb, FieldHelp, SectionIntro } from './index'

describe('FieldHelp', () => {
  it('renders an accessible i button described by closed help text', () => {
    const html = renderToStaticMarkup(createElement(FieldHelp, { label: 'Storage model' }, 'Pick SAN for shared arrays.'))
    expect(html).toContain('aria-label="More information"')
    expect(html).not.toContain('aria-label="About')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('Pick SAN for shared arrays.')
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1]
    const tooltipId = html.match(/role="tooltip" id="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(describedBy).toBe(tooltipId)
    expect(html).not.toContain('data-open')
  })

  it('uses a supplied id so the field input can reference the same help text', () => {
    const html = renderToStaticMarkup(createElement(FieldHelp, { label: 'Tenant', id: 'tenant-tip' }, 'Tenant GUID.'))
    expect(html).toContain('aria-describedby="tenant-tip"')
    expect(html).toContain('role="tooltip" id="tenant-tip"')
  })
})

describe('SectionIntro', () => {
  it('renders the purpose and the checklist of what to have ready', () => {
    const html = renderToStaticMarkup(createElement(SectionIntro, { purpose: 'Define storage.', needs: ['Array model', 'LUN list'] }))
    expect(html).toContain('Define storage.')
    expect(html).toContain('Have ready')
    expect(html).toContain('<li>Array model</li>')
    expect(html).toContain('<li>LUN list</li>')
  })

  it('omits the checklist when nothing is needed', () => {
    const html = renderToStaticMarkup(createElement(SectionIntro, { purpose: 'Review only.' }))
    expect(html).toContain('Review only.')
    expect(html).not.toContain('Have ready')
  })
})

describe('Breadcrumb', () => {
  it('links every level except the current page', () => {
    const html = renderToStaticMarkup(createElement(Breadcrumb, { items: [{ label: 'Configurators', href: '../' }, { label: 'Hyper-V Configurator' }] }))
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('<a href="../">Configurators</a>')
    expect(html).toContain('<span aria-current="page">Hyper-V Configurator</span>')
    expect(html).not.toContain('href="undefined"')
  })
})
