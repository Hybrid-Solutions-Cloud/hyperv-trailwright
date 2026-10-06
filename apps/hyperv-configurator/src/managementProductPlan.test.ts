import {it,expect} from 'vitest'
import {newProject,newComponent,parseProject,serializeProject} from './project'
import {managementProductPlan} from './managementProductPlan'
import {removeManagementV13} from './testing/legacyManagement'
import {environmentFiles} from './exports'
import {sanitizeProject} from './sanitize'

it('retains empty role inputs without creating SQL, identity or other dependency components',()=>{
  const project=newProject();project.components.push(newComponent('vmm'));const before=structuredClone(project),plan=managementProductPlan(project)
  expect(project).toEqual(before);expect(plan.components).toHaveLength(1);expect(plan.components[0].role).toBe('');expect(plan.components[0].runtimeQualified).toBe(false)
  expect(plan.findings.find(f=>f.fieldKey==='role')?.severity).toBe('warning')
  project.components[0].hostingDetails.installProduct=true;expect(managementProductPlan(project).findings.find(f=>f.fieldKey==='role')?.severity).toBe('error')
})
it('applies VMM service prerequisites to an explicitly selected service role',()=>{
  const project=newProject(),c=newComponent('vmm');project.components.push(c);c.version='2025';Object.assign(c.productDetails,{role:'service',serviceTopology:'clustered',osRelease:'ws2022'})
  let codes=managementProductPlan(project).findings.map(f=>f.code);expect(codes).toContain('VMM_SERVICE_OS');expect(codes).toContain('VMM_SERVICE_CLUSTER')
  c.productDetails.role='console';codes=managementProductPlan(project).findings.map(f=>f.code);expect(codes).not.toContain('VMM_SERVICE_OS');expect(codes).not.toContain('VMM_SERVICE_CLUSTER')
})
it('separates SCOM Core role support and role-specific dependencies',()=>{
  const project=newProject(),c=newComponent('scom');project.components.push(c);c.version='2025';Object.assign(c.productDetails,{role:'gateway',osRelease:'ws2025',osInstallType:'core'})
  let plan=managementProductPlan(project);expect(plan.findings.map(f=>f.fieldKey)).toContain('gatewayTrust');expect(plan.findings.map(f=>f.fieldKey)).not.toContain('operationalSql');expect(plan.findings.map(f=>f.code)).not.toContain('SCOM_CORE_ROLE')
  c.productDetails.role='reporting';plan=managementProductPlan(project);expect(plan.findings.map(f=>f.code)).toContain('SCOM_CORE_ROLE');expect(plan.findings.map(f=>f.fieldKey)).toContain('reportingEndpoint')
})
it('retains SQL edition/HA and external service reviews without claiming qualification',()=>{
  const project=newProject(),c=newComponent('sql');project.components.push(c);Object.assign(c.productDetails,{edition:'standard',topology:'ag',engineHost:'external'})
  expect(managementProductPlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['SQL_STANDARD_AG_REVIEW','SQL_EXTERNAL_QUALIFICATION']))
})
it('keeps WAC modes and gateway topology consistent without altering allocations',()=>{
  const project=newProject(),c=newComponent('wac');project.components.push(c);Object.assign(c.productDetails,{mode:'virtualization',deploymentTopology:'gateway',osRelease:'ws2022'})
  const plan=managementProductPlan(project);expect(plan.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['WAC_MODE_TOPOLOGY','WAC_VIRTUAL_OS','WAC_VIRTUAL_CAPACITY']));expect(c.vCpu).toBe(0)
})
it('migrates actual schema 12 records with no invented roles and rejects future or unknown inputs',()=>{
  const project=newProject(),c=newComponent('scom');project.components.push(c);c.productDetails.managementGroup='Preserved group'
  const legacy:any=structuredClone(project);legacy.schemaVersion=12;expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 12')
  removeManagementV13(legacy);const next=parseProject(JSON.stringify(legacy));expect(next.schemaVersion).toBe(32);expect(next.components[0].productDetails.role).toBe('');expect(next.components[0].productDetails.managementGroup).toBe('Preserved group')
  c.productDetails.role='database';expect(()=>serializeProject(project)).toThrow('SCOM primary role')
  c.productDetails.role='management';c.productDetails.actionCredentialRef='literal-credential';expect(()=>serializeProject(project)).toThrow('must use keyvault://')
})
it('preserves inactive role inputs and exports the same plan while removing sharing identities',()=>{
  const project=newProject(),c=newComponent('scom');project.components.push(c);Object.assign(c.productDetails,{role:'gateway',operationalSql:'Private database contract',gatewayTrust:'Private trust review',actionCredentialRef:'secret-ref://private/action'})
  const reopened=parseProject(serializeProject(project));expect(reopened.components[0].productDetails.operationalSql).toBe('Private database contract')
  expect(JSON.parse(environmentFiles(project)['plans/management-products.json'])).toEqual(managementProductPlan(project))
  const shared=serializeProject(sanitizeProject(project));expect(shared).not.toContain('Private');expect(shared).not.toContain('secret-ref://private/action');expect(shared).toContain('secret-ref://withheld/reference')
})
it('does not apply VM CPU or Server OS rules to supplied services and supported client consoles',()=>{
  const project=newProject(),wac=newComponent('wac');project.components.push(wac);wac.hosting='external';wac.productDetails.mode='virtualization'
  expect(managementProductPlan(project).findings.map(f=>f.code)).not.toContain('WAC_VIRTUAL_CAPACITY')
  const console=newComponent('scom');project.components.push(console);console.version='2025';Object.assign(console.productDetails,{role:'console',osRelease:'win11',osEdition:'pro',osInstallType:'client'})
  expect(managementProductPlan(project).findings.filter(f=>f.recordId===console.id).map(f=>f.code)).not.toContain('SCOM_ROLE_OS')
})
