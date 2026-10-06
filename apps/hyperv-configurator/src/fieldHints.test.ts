import {describe,expect,it} from 'vitest'
import {collections,hostingFields,productFields,profileCreationFields} from './catalog'
import {collectionHints,fieldHints,hintFor} from './fieldHints'
import {decisionFields} from './componentDecisionFields'

const allFields = [...collections.flatMap(c => c.fields), ...hostingFields, ...Object.values(productFields).flat(), ...profileCreationFields, ...decisionFields]

describe('field hints', () => {
  it('only names fields that exist', () => {
    expect(Object.keys(fieldHints).filter(key => !allFields.some(f => f.key === key))).toEqual([])
    expect(Object.entries(collectionHints).flatMap(([key, hints]) => Object.keys(hints).filter(field => !collections.find(c => c.key === key)?.fields.some(f => f.key === field)).map(field => `${key}.${field}`))).toEqual([])
  })
  it('applies collection hints without leaking them into other collections or products', () => {
    expect(collections.find(c => c.key === 'clusters')!.fields.find(f => f.key === 'witness')!.hint).toContain('Azure storage account')
    expect(hintFor(productFields.pki.find(f => f.key === 'authority')!)).toBeUndefined()
  })
  it('keeps existing hints and explains every section', () => {
    expect(hintFor(profileCreationFields.find(f => f.key === 'timeZoneId')!)).toContain('VMM build')
    expect(collections.filter(c => !c.description).map(c => c.key)).toEqual([])
    for (const text of [...Object.values(fieldHints), ...Object.values(collectionHints).flatMap(Object.values)]) expect(text.length).toBeLessThan(320)
  })
})
