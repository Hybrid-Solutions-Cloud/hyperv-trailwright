import {it,expect} from 'vitest'
import {load} from 'js-yaml'
import {newProject,newComponent,parseProject,serializeProject} from './project'
import {emptyManagementPlan,managementAdvice} from './managementAdvisor'
import {environmentFiles,managementAdviceMarkdown} from './exports'
import {sanitizeProject} from './sanitize'
import {reviewTarget} from './review'
import {removeHostingV14} from './testing/legacyHosting'

it('keeps unanswered decisions and components unchanged when deriving management candidates',()=>{
  const project=newProject(),before=serializeProject(project),advice=managementAdvice(project)
  expect(advice.options).toEqual([]);expect(advice.unanswered).toHaveLength(13)
  expect(serializeProject(project)).toBe(before)
  project.managementPlan.answers.preparedHosts='yes';project.requirements.bareMetal=true
  expect(managementAdvice(project).options.map(o=>o.id)).toEqual(['classic'])
  expect(managementAdvice(project).reviews).toContain('Mixed starting states are allowed; map prepared and bare-metal hosts individually.')
})
it('honors OEM and operator ownership instead of silently selecting VMM for all bare-metal work',()=>{
  const project=newProject();project.requirements.bareMetal=true
  const finding=managementAdvice(project).findings.find(f=>f.code==='ADVISOR_OS_OWNER')!
  expect(reviewTarget(project,finding)).toEqual({section:'management',fieldKey:'deploymentOwner'})
  project.managementPlan.deploymentOwner='oem';expect(managementAdvice(project).options.map(o=>o.id)).toEqual(['oem'])
  project.managementPlan.deploymentOwner='operator';expect(managementAdvice(project).options.map(o=>o.id)).toEqual(['operator'])
  project.managementPlan.deploymentOwner='vmm';expect(managementAdvice(project).options.map(o=>o.id)).toEqual(['vmm'])
  expect(project.components).toEqual([])
})
it('keeps Arc additive and excludes it for offline or declined readiness without excluding local administration',()=>{
  const project=newProject();project.requirements.offline=true;project.requirements.browserAdmin=true;project.requirements.previewsAccepted=true
  project.managementPlan.answers.azureVmOperations='yes';project.managementPlan.answers.azureReady='yes'
  let advice=managementAdvice(project)
  expect(advice.options.find(o=>o.id==='arc')?.status).toBe('excluded')
  expect(advice.options.find(o=>o.id==='vmm')?.status).toBe('candidate')
  expect(advice.options.find(o=>o.id==='wac-virtual')?.status).toBe('review')
  project.requirements.offline=false;project.managementPlan.answers.azureReady=''
  advice=managementAdvice(project);expect(advice.options.find(o=>o.id==='arc')?.status).toBe('review')
  expect(advice.findings.map(f=>f.code)).toContain('ADVISOR_ARC_READINESS')
  project.managementPlan.answers.azureReady='yes';expect(managementAdvice(project).options.find(o=>o.id==='arc')?.status).toBe('candidate')
})
it('does not promote an accepted preview to generally available or claim HA and feature qualification',()=>{
  const project=newProject(),component=newComponent('wac');component.productDetails.mode='virtualization';project.components.push(component)
  project.requirements.browserAdmin=true;project.requirements.previewsAccepted=true;project.requirements.managementHa=true
  project.managementPlan.answers.productionSupport='yes';project.managementPlan.answers.softwareDefinedFabric='yes'
  let advice=managementAdvice(project);expect(advice.options.find(o=>o.id==='wac-virtual')?.status).toBe('excluded')
  expect(advice.findings.map(f=>f.code)).toContain('ADVISOR_SELECTED_PREVIEW')
  project.managementPlan.answers.productionSupport='no';advice=managementAdvice(project)
  expect(advice.options.find(o=>o.id==='wac-virtual')?.status).toBe('review')
  expect(advice.reviews.join(' ')).toContain('RTO/RPO')
})
it('retains separate tenant, integration, migration, monitoring and commercial decisions',()=>{
  const project=newProject();project.requirements.tenantClouds=true;project.requirements.monitoring=true
  Object.assign(project.managementPlan.answers,{storageIntegration:'yes',computeOptimization:'yes',vmwareConversion:'yes',conversionConstraints:'yes',automation:'yes'})
  const advice=managementAdvice(project)
  expect(advice.options.map(o=>o.id)).toEqual(['vmm','scom'])
  expect(advice.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['ADVISOR_TENANT_INTERFACE','ADVISOR_INTEGRATION','ADVISOR_MIGRATION']))
  expect(advice.commercialReview.join(' ')).toContain('no price or inclusion is inferred')
})
it('migrates schema 10 without invented decisions and rejects future questions and unknown choices',()=>{
  const project=newProject();project.requirements.offline=true
  const legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=10
  expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 10 cannot contain')
  delete legacy.managementPlan
  removeHostingV14(legacy)
  const migrated=parseProject(JSON.stringify(legacy));expect(migrated.managementPlan).toEqual(emptyManagementPlan());expect(migrated.requirements).toEqual(project.requirements)
  migrated.managementPlan.answers.azureReady='maybe' as never;expect(()=>serializeProject(migrated)).toThrow('management decision')
  migrated.managementPlan=emptyManagementPlan();(migrated.managementPlan.answers as any).unexpected='yes';expect(()=>serializeProject(migrated)).toThrow('unknown field')
})
it('exports the same candidates and preserves decisions while scrubbing free-text commercial context',()=>{
  const project=newProject();project.managementPlan.decisionOwner='Private owner';project.managementPlan.decisionEvidence='Private evidence';project.managementPlan.answers.azureVmOperations='no';project.requirements.monitoring=true
  const files=environmentFiles(project)
  expect(load(files['environment/management.yml'])).toMatchObject({decisions:project.managementPlan})
  expect(JSON.parse(files['plans/management-advice.json'])).toEqual(managementAdvice(project))
  expect(managementAdviceMarkdown(project)).toContain('Operations Manager — candidate')
  const shared=sanitizeProject(project);expect(shared.managementPlan.answers.azureVmOperations).toBe('no');expect(serializeProject(shared)).not.toContain('Private')
  expect(parseProject(serializeProject(project)).managementPlan).toEqual(project.managementPlan)
})
