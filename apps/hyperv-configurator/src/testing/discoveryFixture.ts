import { newComponent, newProject } from '../project'
import type { DiscoverySnapshot } from '../discoveryContract'
export function discoveryFixture(collectedAt='2026-09-11T11:00:00Z') {
  const project=newProject();project.id='example-discovery-project';project.name='Discovery review example'
  const component=newComponent('vmm');component.id='example-existing-vmm';component.name='example-vmm';component.lifecycle='preserve';component.hosting='hyperv-existing';component.vCpu=4;component.memoryGiB=8
  project.components=[component]
  const snapshot:DiscoverySnapshot={kind:'hyperv-discovery-snapshot',schemaVersion:1,id:'example-snapshot',projectId:project.id,collectedAt,source:{provider:'hyperv',endpoint:'example-host.example.test',collector:'Read-HyperVInventory.ps1',version:'0.1.0'},observations:[{targetId:component.id,resourceType:'components',externalId:'11111111-1111-1111-1111-111111111111',status:'observed',values:{vCpu:8,memoryGiB:16},message:'Configured CPU and startup memory only.'}]}
  return {project,component,snapshot}
}
