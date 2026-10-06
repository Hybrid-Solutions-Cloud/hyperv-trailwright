import {it,expect} from 'vitest'
import {newProject,newComponent,componentTotals,parseProject,serializeProject} from './project'
import {omitComponent,restoreComponent,omissionFindings,omissionSummary,type OmissionProject} from './componentOmissions'
import {hostingPlan} from './hostingPlan'
import {managementProductPlan} from './managementProductPlan'
import {referenceOptions} from './references'
import {collections,newRecord} from './catalog'
import {stagePlan} from './stagePlan'
import {sanitizeProject} from './sanitize'
import {environmentFiles} from './exports'
import {reviewTarget} from './review'
import {removeAvailabilityV17} from './testing/legacyAvailabilityDetails'
const fixture=()=>{const project:OmissionProject={...newProject(),omittedComponents:[]},c=newComponent('vmm');c.name='Existing VMM';c.lifecycle='configure';c.vCpu=4;c.memoryGiB=16;c.diskGiB=100;c.hostingDetails.installProduct=true;c.productDetails.dkm='Preserved DKM';project.components.push(c);return {project,c}}
it('omits a component reversibly without mutating its configuration or the source project',()=>{
  const {project,c}=fixture(),before=structuredClone(project),next=omitComponent(project,c.id)
  expect(project).toEqual(before);expect(next.components).toHaveLength(0);expect(next.omittedComponents[0].component).toEqual(c);expect(next.omittedComponents[0].reason).toBe('');expect(next.omittedComponents[0].reviewOwner).toBe('')
  expect(restoreComponent(next,c.id).components[0]).toEqual(c)
})
it('excludes omitted capacity, provider actions and dependency options without deleting design references',()=>{
  const {project,c}=fixture();project.design.dependencies=[{id:'dependency',values:{dependent:c.id,prerequisite:'missing',phase:'bootstrap'}}]
  const stage=newRecord(collections.find(c=>c.key==='stages')!);Object.assign(stage.values,{name:'Configure VMM',kind:'management',executor:'operator',targets:JSON.stringify([c.id]),status:'planned',acceptance:'Review role acceptance'});project.design.stages.push(stage)
  const next=omitComponent(project,c.id);expect(componentTotals(next)).toMatchObject({instances:0,vCpu:0,memoryGiB:0,diskGiB:0});expect(hostingPlan(next).components).toEqual([]);expect(managementProductPlan(next).components).toEqual([]);expect(referenceOptions(next,'$components')).toEqual([]);expect(next.design.dependencies).toEqual(project.design.dependencies)
  expect(stagePlan(next).findings.map(f=>f.code)).toContain('STAGE_TARGET_MISSING')
})
it('keeps omission rationale explicit and does not treat a retained install flag as an active request',()=>{
  const {project,c}=fixture(),next=omitComponent(project,c.id);expect(omissionFindings(next).map(f=>f.code)).toEqual(['COMPONENT_OMISSION_REASON','COMPONENT_OMISSION_OWNER']);next.omittedComponents[0].reason='Outside this design scope';next.omittedComponents[0].reviewOwner='Design owner';expect(omissionFindings(next)).toEqual([]);expect(omissionSummary(next).components[0]).toMatchObject({active:false,priorLifecycle:'configure',reason:'Outside this design scope'})
})
it('rejects missing identities and conflicting restores',()=>{
  const {project,c}=fixture();expect(()=>omitComponent(project,'missing')).toThrow('no longer exists');const next=omitComponent(project,c.id);next.components.push(c);expect(()=>restoreComponent(next,c.id)).toThrow('already uses')
})
it('migrates schema 14 without omitting anything and validates retained records as strictly as active ones',()=>{
  const {project,c}=fixture(),old:any=structuredClone(project);old.schemaVersion=14;expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 14');delete old.omittedComponents;removeAvailabilityV17(old);const next=parseProject(JSON.stringify(old));expect(next.schemaVersion).toBe(32);expect(next.components).toEqual(project.components);expect(next.omittedComponents).toEqual([])
  const omitted=omitComponent(project,c.id);omitted.omittedComponents[0].component.hostingDetails.providerCredentialRef='literal';expect(()=>serializeProject(omitted)).toThrow('must use keyvault://')
  omitted.omittedComponents[0].component.hostingDetails.providerCredentialRef='';omitted.components.push(c);expect(()=>serializeProject(omitted)).toThrow('unique')
  omitted.components=[];omitted.omittedComponents[0].omittedAt='2026-02-30T12:00:00Z';expect(()=>serializeProject(omitted)).toThrow('Omission time')
})
it('scrubs archived identities and rationale without deleting unresolved stage links',()=>{
  const {project,c}=fixture();c.hostingDetails.resourceId='private-provider-id';c.credentialRef='secret-ref://private/vmm'
  const stage=newRecord(collections.find(c=>c.key==='stages')!);stage.values.targets=JSON.stringify([c.id]);project.design.stages.push(stage)
  const omitted=omitComponent(project,c.id);omitted.omittedComponents[0].reason='Private scope decision';omitted.omittedComponents[0].reviewOwner='Private reviewer'
  const shared=parseProject(serializeProject(sanitizeProject(omitted))),archived=shared.omittedComponents[0].component
  expect(JSON.stringify(shared)).not.toContain('private-provider-id');expect(JSON.stringify(shared)).not.toContain('Private');expect(archived.credentialRef).toBe('secret-ref://withheld/reference');expect(JSON.parse(String(shared.design.stages[0].values.targets))).toEqual([archived.id])
})
it('exports omissions as a separate archive and sends review findings to their retained record',()=>{
  const {project,c}=fixture(),omitted=omitComponent(project,c.id),files=environmentFiles(omitted)
  expect(JSON.parse(files['plans/component-omissions.json']).components[0]).toMatchObject({componentId:c.id,active:false});expect(files['archive/omitted-components.yml']).toContain('Preserved DKM');expect(JSON.parse(files['plans/component-hosting.json']).components).toEqual([])
  expect(reviewTarget(omitted,omissionFindings(omitted)[0])).toEqual({section:'management',recordId:c.id,fieldKey:'omissionReason'})
})
