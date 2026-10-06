import {describe,it,expect} from 'vitest'
import {projectReadiness,readinessStates} from './projectReadiness'
import {newProject,serializeProject,parseProject} from './project'
import {demoProject} from './scenarios'
import {environmentFiles} from './exports'
import {licensingFixture} from './testing/licensingFixture'
import {collections,newRecord} from './catalog'
import {stagePlan} from './stagePlan'

const completeEvidence={errors:0,reviews:0,missingInputs:0,consumers:[],unmappedStages:[],stageBlocked:0,running:0,failed:0,reportedPassed:0,stageCount:0,sdnObservationStatus:'not-selected'}
describe('independent design, adapter and runtime readiness',()=>{
  it('requires both complete inputs and resolved reviews before design-complete',()=>{
    expect(readinessStates(completeEvidence)).toMatchObject({designState:'design-complete',runtimeState:'unknown',deploymentVerified:false,allStagesReportedPassed:false})
    for(const key of ['errors','reviews','missingInputs'])expect(readinessStates({...completeEvidence,[key]:1}).designState).toBe('draft')
    expect(projectReadiness(newProject()).designState).toBe('draft')
  })
  it('does not require bundled adapters to complete a configuration',()=>{
    expect(readinessStates(completeEvidence)).toMatchObject({designState:'design-complete',automationReady:false,deploymentVerified:false})
    expect(projectReadiness(newProject())).not.toHaveProperty('consumers')
  })
  it('never treats successful operator observations as authenticated deployment',()=>{
    expect(readinessStates({...completeEvidence,reportedPassed:2,stageCount:2})).toMatchObject({runtimeState:'operator-reported',allStagesReportedPassed:true,deploymentVerified:false})
    expect(readinessStates({...completeEvidence,sdnObservationStatus:'passed-observation'})).toMatchObject({runtimeState:'operator-reported',deploymentVerified:false})
    expect(readinessStates({...completeEvidence,running:1}).runtimeState).toBe('in-progress')
    expect(readinessStates({...completeEvidence,failed:1}).runtimeState).toBe('review-failure')
    expect(readinessStates({...completeEvidence,sdnObservationStatus:'failed'}).runtimeState).toBe('review-failure')
    for(const status of ['stale','partial','ambiguous','design-unresolved'])expect(readinessStates({...completeEvidence,sdnObservationStatus:status,reportedPassed:1,running:1}).runtimeState).toBe('review-required')
  })
  it('retains external tool references and rejects future observation dates',()=>{
    const {project,vm}=licensingFixture(),stage=newRecord(collections.find(c=>c.key==='stages')!)
    Object.assign(stage.values,{name:'Example acceptance',owner:'Example operator',kind:'validate',executor:'powershell',consumer:'Unqualified.ps1',version:'1.0.0',runner:'example-runner',targets:JSON.stringify([vm.id]),status:'passed',evidence:'Example future claim',observedAt:'2099-01-01T00:00:00Z',acceptance:'Example criteria'})
    project.design.stages.push(stage)
    const next=structuredClone(stage);next.id='next-stage';next.values.name='Example downstream';next.values.dependsOn=stage.id;next.values.status='planned';project.design.stages.push(next)
    const plan=stagePlan(project),readiness=projectReadiness(project)
    expect(plan.findings.some(f=>f.code==='STAGE_FUTURE_EVIDENCE')).toBe(true)
    expect(plan.blockedStageIds).toEqual([stage.id,next.id].sort())
    expect(readiness).toMatchObject({runtimeState:'review-required',automationReady:false,deploymentVerified:false})
    stage.values.observedAt='2026-09-10T00:00:00Z';expect(stagePlan(project).stages.find(s=>s.id===stage.id)?.disposition).toBe('reported-passed')
  })
  it('keeps saved answers intact and exports one readiness assessment',()=>{
    const project=demoProject(1),before=serializeProject(project),readiness=projectReadiness(project),files=environmentFiles(project)
    expect(JSON.parse(files['plans/project-readiness.json'])).toEqual(readiness)
    expect(files['reports/project-readiness.md']).toContain(`Design: ${readiness.designState}`)
    expect(files['reports/design.md']).toContain('## Project readiness')
    expect(serializeProject(project)).toBe(before);expect(parseProject(files['project.json'])).toEqual(project)
    expect(readiness.deploymentVerified).toBe(false)
  })
})
