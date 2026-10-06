import {it,expect} from 'vitest'
import {newProject,newComponent,parseProject,serializeProject,componentTotals} from './project'
import {newRecord,collections} from './catalog'
import {managementNetworksCollection,additionalProducts} from './hostingContractFields'
import {hostingPlan} from './hostingPlan'
import {removeHostingV14} from './testing/legacyHosting'
import {environmentFiles,topology} from './exports'
import {sanitizeProject} from './sanitize'

it('separates action owners and prevents configuration under a preserve lifecycle',()=>{
  const project=newProject(),c=newComponent('wac');project.components.push(c);c.lifecycle='preserve';c.hosting='vsphere';c.hostingDetails.configureGuest=true
  const plan=hostingPlan(project);expect(plan.findings.map(f=>f.code)).toContain('HOSTING_PRESERVE');expect(plan.findings.map(f=>f.fieldKey)).toEqual(expect.arrayContaining(['guestOwner','resourceId','currentEvidence','providerCredentialRef','poolId','datacenterId','consumer','consumerVersion']))
  expect(plan.components[0].actions.filter(a=>a.selected).map(a=>a.key)).toEqual(['configureGuest']);expect(plan.components[0].executionReady).toBe(false)
})
it('preserves manual OME and external-service boundaries for imported action flags',()=>{
  const project=newProject(),ome=newComponent('ome'),external=newComponent('sql');project.components.push(ome,external);ome.hostingDetails.createInfrastructure=true;external.hosting='external';external.hostingDetails.installProduct=true
  expect(hostingPlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['OME_MANUAL_HOSTING','EXTERNAL_SERVICE_ACTION']))
})
it('keeps dedicated physical Windows inventory independent of Hyper-V cluster records',()=>{
  const project=newProject(),c=newComponent('vmm');project.components.push(c);c.hosting='physical';c.hostingDetails.installProduct=true
  const keys=hostingPlan(project).findings.map(f=>f.fieldKey);expect(keys).toContain('physicalInventory');expect(keys).toContain('physicalBoot');expect(keys).not.toContain('poolId');expect(project.design.hosts).toHaveLength(0)
})
it('rejects impossible baseline dates and floating consumer versions',()=>{
  const project=newProject(),c=newComponent('wac');project.components.push(c);c.lifecycle='configure';c.hostingDetails.currentObservedAt='2026-02-30T12:00:00Z';c.hostingDetails.consumerVersion='latest'
  expect(hostingPlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['HOSTING_BASELINE_TIME','HOSTING_FLOATING_CONSUMER']))
})
function networkFixture(){
  const project=newProject(),a=newComponent('wac'),b=newComponent('scom');project.components.push(a,b)
  project.design.networks=['a','b'].map((scope,i)=>{const row=newRecord(collections.find(c=>c.key==='networks')!);row.id='n'+(i+1);Object.assign(row.values,{name:'Network '+scope,cidr:'10.0.0.0/24',routingScope:'fabric-'+scope});return row})
  project.design.managementNetworks=[a,b].map((c,i)=>{const row=newRecord(managementNetworksCollection);Object.assign(row.values,{name:'NIC '+i,owner:'Operator',component:c.id,network:'n'+(i+1),lifecycle:'new',providerNetworkId:'provider-network-'+i,addressing:'static',ip:'10.0.0.10/24',gateway:'10.0.0.1',dns:'10.0.0.2',acceptance:'Address and routing acceptance'});return row})
  return project
}
it('validates attachment addresses within routing scope without rejecting isolated overlaps',()=>{
  const project=networkFixture();expect(hostingPlan(project).findings.filter(f=>f.section==='network')).toEqual([])
  project.design.networks[1].values.routingScope='fabric-a';expect(hostingPlan(project).findings.map(f=>f.code)).toContain('COMPONENT_NETWORK_DUPLICATE')
  project.design.managementNetworks[1].values.ip='10.0.1.10/24';expect(hostingPlan(project).findings.map(f=>f.code)).toContain('COMPONENT_NETWORK_SUBNET')
})
it('rejects reserved addresses, wrong gateways and changes beneath preserved components',()=>{
  const project=networkFixture(),a=project.design.managementNetworks[0];project.components[0].lifecycle='preserve';a.values.ip='10.0.0.0/24';a.values.gateway='10.0.1.1';a.values.dns='resolver.example'
  expect(hostingPlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['COMPONENT_NETWORK_PRESERVE','COMPONENT_NETWORK_RESERVED','COMPONENT_NETWORK_GATEWAY','COMPONENT_NETWORK_DNS']))
})
it('migrates actual schema 13 without inventing identities, owners or network attachments',()=>{
  const project=newProject(),c=newComponent('wac');project.components.push(c);c.hostingDetails.configureGuest=true
  const old:any=structuredClone(project);old.schemaVersion=13;expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 13')
  removeHostingV14(old);const next=parseProject(JSON.stringify(old));expect(next.schemaVersion).toBe(32);expect(next.components[0].hostingDetails.configureGuest).toBe(true);expect(next.components[0].hostingDetails.resourceId).toBe('');expect(next.design.managementNetworks).toEqual([])
  old.components[0].hostingDetails.guestOwner='Invented';expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 13')
})
it('adds omitted component categories only by explicit selection and retains them in capacity and exports',()=>{
  const project=newProject();expect(project.components).toEqual([])
  for(const product of Object.keys(additionalProducts) as (keyof typeof additionalProducts)[]){const c=newComponent(product);c.vCpu=2;c.memoryGiB=4;c.diskGiB=40;project.components.push(c)}
  const next=parseProject(serializeProject(project));expect(next.components.map(c=>c.product)).toEqual(['admin','backup','patching','integration']);expect(componentTotals(next)).toMatchObject({instances:4,vCpu:8,memoryGiB:16,diskGiB:160})
  expect(JSON.parse(environmentFiles(next)['plans/component-hosting.json']).components).toHaveLength(4)
})
it('preserves linked network identities while scrubbing provider identities and credentials for sharing',()=>{
  const project=networkFixture(),c=project.components[0];c.hostingDetails.resourceId='private-provider-id';c.hostingDetails.providerCredentialRef='secret-ref://private/provider'
  const shared=parseProject(serializeProject(sanitizeProject(project)));expect(JSON.stringify(shared)).not.toContain('private-provider-id');expect(JSON.stringify(shared)).toContain('secret-ref://withheld/reference')
  for(const row of shared.design.managementNetworks){expect(shared.components.some(c=>c.id===row.values.component)).toBe(true);expect(shared.design.networks.some(n=>n.id===row.values.network)).toBe(true)}
  const exported=JSON.parse(environmentFiles(project)['plans/component-hosting.json']);expect(exported.projectId).toBe(project.id);expect(exported.components[0].resourceId).toBe('private-provider-id');expect(exported.components[0].executionReady).toBe(false)
  const diagram=topology(project).drawio,nic=project.design.managementNetworks[0]
  expect(diagram).toContain(`source="n:${c.id}" target="n:${nic.id}"`);expect(diagram).toContain(`source="n:${nic.values.network}" target="n:${nic.id}"`)
})
