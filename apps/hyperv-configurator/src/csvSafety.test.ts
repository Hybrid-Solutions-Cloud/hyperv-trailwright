import { it, expect } from 'vitest'
import { billOfMaterialsCsv } from './exports'
import { demoProject } from './scenarios'

it('escapes spreadsheet formula prefixes in the bill-of-materials CSV', () => {
  const project = demoProject(1)
  expect(project.components.length).toBeGreaterThan(0)
  project.components[0].name = '=HYPERLINK("https://example.invalid","x")'
  const csv = billOfMaterialsCsv(project)
  expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"",""x"")"`)
  expect(csv).not.toMatch(/(^|,)"[=+@]/m)
})
