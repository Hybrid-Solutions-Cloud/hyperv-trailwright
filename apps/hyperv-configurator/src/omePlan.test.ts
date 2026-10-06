import {it,expect} from 'vitest'
import {newComponent,newProject,parseProject,serializeProject} from './project'
import {omeAppliancePlan,omeDiscoveryTargets} from './omePlan'
import {omePlugins,omePlanningFields} from './omeFields'
import {environmentFiles,omeMarkdown} from './exports'
import {sanitizeProject} from './sanitize'
import {removeHostingV14} from './testing/legacyHosting'

const appliance=()=>{const c=newComponent('ome');c.version='4.7';c.ome.devices=500;c.productDetails.sizingProfile='small';c.productDetails.capacityUnits='binary';for(const p of omePlugins){c.productDetails['plugin_'+p.key]='disabled';c.productDetails['pluginVersion_'+p.key]=p.version}return c}
it('adds selected plug-in memory without multiplying CPU and preserves unknown selections',()=>{
  const c=appliance();expect(omeAppliancePlan(c).required).toMatchObject({vCpu:4,memoryGiB:19,primaryDiskGiB:415,secondaryDiskGiB:415})
  for(const p of omePlugins)c.productDetails['plugin_'+p.key]='enabled'
  expect(omeAppliancePlan(c).required?.memoryGiB).toBe(40)
  c.productDetails.sizingProfile='large';c.ome.devices=1000;expect(omeAppliancePlan(c).required).toMatchObject({vCpu:16,memoryGiB:64})
  c.productDetails.plugin_aiops='';expect(omeAppliancePlan(c).vendor).toBeNull()
})
it('requires release and units review and does not overwrite allocated resources',()=>{
  const c=appliance(),before=structuredClone(c);omeAppliancePlan(c);expect(c).toEqual(before)
  c.productDetails.capacityUnits='';expect(omeAppliancePlan(c).required).toBeNull()
  c.productDetails.capacityUnits='decimal';expect(omeAppliancePlan(c).required).toMatchObject({memoryGiB:18,primaryDiskGiB:387})
  c.version='4.6';expect(omeAppliancePlan(c).vendor).toBeNull();expect(omeAppliancePlan(c).findings.map(f=>f.code)).toContain('OME_RELEASE')
  c.productDetails.sizingProfile='manual';c.productDetails.primaryDiskGiB=415;c.productDetails.secondaryDiskGiB=0;c.diskGiB=415
  expect(omeAppliancePlan(c).findings.map(f=>f.code)).not.toContain('OME_DISKS');expect(omeAppliancePlan(c).findings.find(f=>f.code==='OME_SIZING_EVIDENCE')?.severity).toBe('error')
})
it('enforces device boundaries, extra-large plug-in exclusions and separate expanded disks',()=>{
  const c=appliance();c.ome.devices=1000;expect(omeAppliancePlan(c).findings.map(f=>f.code)).toContain('OME_PROFILE_LIMIT')
  c.ome.devices=25000;c.productDetails.sizingProfile='extraLarge';expect(omeAppliancePlan(c).required).toMatchObject({vCpu:64,memoryGiB:256,primaryDiskGiB:600,secondaryDiskGiB:415})
  c.productDetails.plugin_vmm='enabled';expect(omeAppliancePlan(c).vendor).toBeNull();expect(omeAppliancePlan(c).findings.map(f=>f.code)).toContain('OME_XL_PLUGINS')
})
it('merges IPv4 overlaps without enumerating addresses or equating DNS names with inventory',()=>{
  expect(omeDiscoveryTargets('10.0.0.0/24\n10.0.0.1-10.0.0.4\n10.0.1.1\nbmc.example\nBMC.EXAMPLE')).toMatchObject({addressCount:257,dnsNames:1,errors:[]})
  expect(omeDiscoveryTargets('0.0.0.0/0').addressCount).toBe(4294967296)
  expect(omeDiscoveryTargets('10.0.0.4-10.0.0.1\n999.1.1.1\nhttps://host/path').errors).toHaveLength(3)
})
it('requires actual observation fields and never infers acceptance from HTTPS or entered success',()=>{
  const c=appliance();c.endpoint='https://ome.example';c.productDetails.manual_import='reported';c.productDetails.manualOwner_import='Operator';c.productDetails.manualEvidence_import='Change reference';c.productDetails.manualAt_import='2100-01-01T00:00:00Z'
  const p=omeAppliancePlan(c,Date.parse('2026-09-11T00:00:00Z'));expect(p.runtimeQualified).toBe(false);expect(p.installation).toBe('manual');expect(p.findings.map(f=>f.code)).toContain('OME_CHECKLIST_TIME')
  c.productDetails.manualAt_import='2026-02-30T12:00:00Z';expect(omeAppliancePlan(c).findings.map(f=>f.code)).toContain('OME_CHECKLIST_TIME')
})
it('migrates OME answers without inventing plug-in, sizing or acceptance decisions',()=>{
  const project=newProject(),c=appliance();project.components.push(c)
  const old:any=structuredClone(project);old.schemaVersion=11
  for(const f of omePlanningFields)delete old.components[0].productDetails[f.key]
  removeHostingV14(old)
  const next=parseProject(JSON.stringify(old));expect(next.schemaVersion).toBe(32);expect(next.components[0].id).toBe(c.id);expect(next.components[0].ome).toEqual(c.ome)
  expect(next.components[0].productDetails.plugin_aiops).toBe('');expect(next.components[0].productDetails.manual_import).toBe('')
  old.components[0].productDetails.sizingProfile='small';expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 11')
  c.productDetails.plugin_aiops='maybe';expect(()=>serializeProject(project)).toThrow('Unknown')
})
it('exports derived OME plans consistently and scrubs addresses, identities and evidence in sharing copies',()=>{
  const project=newProject(),c=appliance();project.components.push(c);c.productDetails.idracTargets='10.0.0.1';c.productDetails.discoveryCredentialRef='secret-ref://example/idrac';c.productDetails.manualEvidence_import='private-change-123'
  const files=environmentFiles(project),plan=JSON.parse(files['plans/ome-manual.json'])
  expect(plan.projectId).toBe(project.id);expect(plan.appliances[0].vendor.memoryGB).toBe(19);expect(plan.appliances[0].runtimeQualified).toBe(false)
  expect(omeMarkdown(project)).toContain('19 GB memory');const shared=serializeProject(sanitizeProject(project));expect(shared).not.toContain('10.0.0.1');expect(shared).not.toContain('private-change-123');expect(shared).toContain('secret-ref://withheld/reference')
})
