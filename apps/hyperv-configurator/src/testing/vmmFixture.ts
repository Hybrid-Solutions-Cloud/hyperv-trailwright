import { collections, newRecord, type Answers } from '../catalog'
import { newProject } from '../project'

export function vmmFixture() {
  const project = newProject()
  const add = (key: string, id: string, values: Answers) => { const row = newRecord(collections.find(c=>c.key===key)!); row.id=id; row.values={...row.values,...values}; project.design[key].push(row); return row }
  add('clusters','cluster-a',{name:'Example', intent:'vmm', startingState:'baremetal', authority:'vmm'})
  add('networks','net-a',{name:'Management', purpose:'management', cidr:'192.0.2.0/24'})
  const profile = add('profiles','profile-a',{name:'Example profile',method:'vmm',profileState:'existing',profileRef:'11111111-1111-1111-1111-111111111111',vmmEndpoint:'vmm.example.test',vmmVersion:'10.25.1.0',vmmModuleVersion:'1.0.0.0',hostGroupId:'22222222-2222-2222-2222-222222222222',logicalNetworkId:'33333333-3333-3333-3333-333333333333',wdsServer:'pxe.example.test',wdsRegistration:'Recorded',adkVersion:'Recorded',winpeVersion:'Recorded',hardwareApplicability:'Recorded',storagePrerequisites:'Recorded',preflight:'Recorded',completion:'Recorded'})
  const host = add('hosts','host-a',{name:'example-hv01',fqdn:'example-hv01.example.test',cluster:'cluster-a',profile:'profile-a',lifecycle:'create',uuid:'44444444-4444-4444-4444-444444444444',bmcAddress:'bmc.example.test',bmcProtocol:'ipmi',bmcPort:623,bmcRunAsId:'55555555-5555-5555-5555-555555555555',managementAdapter:'adapter-a',managementIp:'192.0.2.10'})
  const adapter = add('adapters','adapter-a',{name:'Management port',host:'host-a',authority:'vmm',mac:'02:00:00:00:00:01',network:'net-a'})
  Object.assign(host.values,{currentState:'baremetal',osAction:'install',osOwner:'vmm',hostRoleAction:'enable',hostRoleOwner:'vmm',clusterAction:'none',clusterJoinOwner:'preserve',inventoryObservedAt:'2026-09-11T12:00:00Z',inventoryEvidence:'EXAMPLE physical inventory'})
  return {project,profile,host,adapter}
}
