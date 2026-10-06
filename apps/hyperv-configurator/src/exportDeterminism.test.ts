import {describe,it,expect} from 'vitest'
import {demoProject} from './scenarios'
import {environmentFiles} from './exports'
describe('export determinism',()=>{
  it('produces identical environment and data files for the same project',()=>{
    const p=demoProject(1)
    const first=environmentFiles(p),second=environmentFiles(p)
    expect(Object.keys(second).sort()).toEqual(Object.keys(first).sort())
    for(const path of Object.keys(first))expect(second[path],path).toEqual(first[path])
  })
})
