import {describe,it,expect} from 'vitest'
import {load} from 'js-yaml'
import {newProject,newComponent,parseProject,serializeProject} from './project'
import {collections,newRecord} from './catalog'
import {emptyContext,workflowSections,workflowFindings} from './workflow'
import {sanitizeProject} from './sanitize'
import {environmentFiles,designMarkdown} from './exports'
import {reviewTarget,designProgress} from './review'
import {removeHostingV14} from './testing/legacyHosting'

describe('scope and project context',()=>{
  it('migrates old scope without inventing management decisions or accepting future context',()=>{
    const project=newProject();project.scope='cluster'
    const legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=9
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 9 cannot contain')
    delete legacy.context
    delete legacy.managementPlan
    removeHostingV14(legacy)
    const migrated=parseProject(JSON.stringify(legacy))
    expect(migrated).toEqual({...project,context:emptyContext()})
    expect(workflowFindings(migrated).map(f=>f.code)).toContain('MANAGEMENT_BOUNDARY')
    migrated.context.managementSource='invalid' as never
    expect(()=>serializeProject(migrated)).toThrow('management source')
  })
  it('keeps dedicated management host prerequisites while skipping empty external host editors',()=>{
    const project=newProject();project.scope='management';const component=newComponent('wac');project.components.push(component)
    expect(workflowSections(project).map(s=>s.key)).toContain('hardware')
    expect(workflowFindings(project).map(f=>f.code)).toContain('CLUSTER_REQUIRED')
    component.hosting='vcd'
    expect(workflowSections(project).map(s=>s.key)).not.toContain('hardware')
    expect(workflowSections(project).map(s=>s.key)).toEqual(expect.arrayContaining(['topology','storage','network','identity','hosting']))
    expect(workflowFindings(project)).toEqual([])
    expect(workflowSections(project,true)).toHaveLength(14)
    expect(workflowSections(project,false,'hardware').map(s=>s.key)).toContain('hardware')
  })
  it('preserves populated editors and inactive SDN records across scope changes',()=>{
    const project=newProject(),profile=newRecord(collections.find(c=>c.key==='profiles')!)
    project.design.profiles.push(profile);project.scope='management'
    project.design.sdnResources.push(newRecord(collections.find(c=>c.key==='sdnResources')!))
    const before=serializeProject(project)
    expect(workflowSections(project).map(s=>s.key)).toEqual(expect.arrayContaining(['hardware','sdn']))
    expect(serializeProject(project)).toBe(before)
    expect(parseProject(before).design).toEqual(project.design)
  })
  it('requires a reviewed cluster management boundary and routes findings to the exact field',()=>{
    const project=newProject();project.scope='cluster'
    const finding=workflowFindings(project).find(f=>f.code==='MANAGEMENT_BOUNDARY')!
    expect(reviewTarget(project,finding)).toEqual({section:'management',fieldKey:'managementSource'})
    project.context.managementSource='external';project.context.managementOwner='Platform team';project.context.managementEvidence='Existing service capacity, connectivity and acceptance reviewed.'
    expect(workflowFindings(project).some(f=>f.code.startsWith('MANAGEMENT_'))).toBe(false)
    expect(designProgress(project,[]).find(r=>r.section==='management')).toMatchObject({required:3,answered:3})
    project.context.managementSource='deferred'
    expect(workflowFindings(project).find(f=>f.code==='MANAGEMENT_DEFERRED')?.severity).toBe('warning')
    project.context.managementSource='notrequired';project.requirements.bareMetal=true
    expect(workflowFindings(project).map(f=>f.code)).toContain('MANAGEMENT_BOUNDARY_CONFLICT')
  })
  it('allows existing management-only documentation without inventing a workload cluster',()=>{
    const project=newProject();project.scope='existing'
    expect(workflowFindings(project).map(f=>f.code)).toContain('EXISTING_INVENTORY')
    const component=newComponent('wac');component.lifecycle='preserve';component.hosting='vcd';project.components.push(component)
    expect(workflowFindings(project)).toEqual([])
    expect(parseProject(serializeProject(project)).components[0].lifecycle).toBe('preserve')
    expect(workflowSections(project)).toHaveLength(14)
  })
  it('retains private context in owned exports and removes it from shared exports',()=>{
    const project=newProject();project.scope='cluster';Object.assign(project.context,{customer:'Private customer',scenarioId:'PRIVATE-17',naming:'private-prefix',supportTarget:'Private review owner',managementSource:'external',managementOwner:'Private platform team',managementEvidence:'Private acceptance record'})
    expect(parseProject(serializeProject(project)).context).toEqual(project.context)
    expect(load(environmentFiles(project)['environment/scenario.yml'])).toMatchObject({context:project.context,deployment_state:'not_executed_by_configurator'})
    expect(designMarkdown(project)).toContain('| Management service source | Supplied by another team |')
    const shared=sanitizeProject(project)
    expect(shared.context.managementSource).toBe('external')
    expect(serializeProject(shared)).not.toMatch(/Private|PRIVATE/)
    expect(serializeProject(project)).toContain('PRIVATE-17')
  })
})
