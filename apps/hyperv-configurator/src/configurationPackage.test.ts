import {describe,it,expect} from 'vitest'
import {environmentFiles} from './exports'
import {demoProject} from './scenarios'
import {parseProject,serializeProject} from './project'
import {vmmFixture} from './testing/vmmFixture'
import {vmmProfileFixture} from './testing/vmmProfileFixture'
import {clusterFixture} from './testing/clusterFixture'
import {quorumFixture} from './testing/quorumFixture'
import {quorumConfiguration} from './quorumConfiguration'
import {validate} from './validation'

describe('configuration package boundary',()=>{
  const projects=[...Array.from({length:8},(_,i)=>demoProject(i+1)),vmmFixture().project,vmmProfileFixture().project,clusterFixture().project,quorumFixture('cloud').project]
  for(const [i,project] of projects.entries())it(`preserves design ${i+1} without producing automation`,()=>{
    const before=serializeProject(project),files=environmentFiles(project)
    expect(serializeProject(parseProject(files['project.json']))).toBe(before)
    expect(Object.keys(files).filter(p=>/\.(ps1|psm1|sh|tf|bat|cmd)$/i.test(p)||p.startsWith('adapters/')||p.startsWith('execution/'))).toEqual([])
    expect(files['environment/hardware.yml']).toBeDefined()
    expect(files['environment/networking.yml']).toBeDefined()
    expect(files['environment/storage.yml']).toBeDefined()
    expect(files['environment/licensing.yml']).toBeDefined()
    for(const path of ['reports/high-level-design.md','reports/low-level-design.md','reports/bill-of-materials.csv','validation/results.md'])expect(files[path],path).toBeDefined()
    expect(files['reports/bill-of-materials.csv']).toContain('Resource ID')
    expect(files['reports/design.md']).toContain('This package contains no deployment scripts.')
    expect(JSON.parse(files['validation/results.json']).packagePurpose).toBe('configuration-design')
    expect(serializeProject(project)).toBe(before)
  })
  it('retains witness design checks without requiring installed runtime identifiers',()=>{
    const {project}=quorumFixture('cloud'),cluster=project.design.clusters[0]
    cluster.values.clusterModuleVersion='';cluster.values.seedHost='';cluster.values.build=''
    expect(quorumConfiguration(project).status).toBe('design-handoff')
    cluster.values.witnessAccountName='INVALID ACCOUNT'
    expect(validate(project).some(f=>f.code==='quorum-cloud')).toBe(true)
  })
})
