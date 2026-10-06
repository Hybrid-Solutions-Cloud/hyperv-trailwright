import type { Project } from './project'
import {sdnCollectionKeys} from './sdnFields'

const resourceCollections = ['sites', 'clusters', 'hosts', 'profiles', 'storageSystems', 'storageInterfaces', 'disks', 'volumes', 'networks', 'adapters', 'hostSwitches', 'hostVnics', 'managementNetworks', 'sdnResources', 'bgpPeers', 'tenantServices', 'identities', 'media', 'availabilityGroups']

export function referenceOptions(project: Project, collection: string): { id: string; name: string }[] {
  if(collection==='$licenseDependencyTargets')return [...new Map([...referenceOptions(project,'$licenseTargets'),...referenceOptions(project,'$resources')].map(r=>[r.id,r])).values()]
  if(collection==='$sqlComponents')return project.components.filter(c=>c.product==='sql').map(c=>({id:c.id,name:c.name||c.id}))
  if(collection==='$licensePhysicalServers')return [...project.design.hosts,...project.design.licenseServers].map(r=>({id:r.id,name:String(r.values.name||r.id)}))
  if(collection==='$licenseTargets')return [
    ...project.components.map(c=>({id:c.id,name:`${c.name||c.id} (${c.product})`})),
    ...[...project.design.hosts,...project.design.licenseServers,...project.design.workloads,...(project.sdn.scope==='none'?[]:project.design.sdnResources.filter(r=>r.values.role!=='hostcontroller'))].map(r=>({id:r.id,name:String(r.values.name||r.id)})),
  ]
  if (collection === '$licenseVMs') return [
    ...project.components.filter(c=>!['external','physical'].includes(c.hosting) && c.product!=='ome').map(c=>({id:c.id,name:`${c.name || c.id} (${c.product})`})),
    ...project.design.workloads.map(r=>({id:r.id,name:`${r.values.name || r.id} (workload)`})),
    ...(project.sdn.scope==='none'?[]:project.design.sdnResources.filter(r=>r.values.role!=='hostcontroller').map(r=>({id:r.id,name:`${r.values.name || r.id} (SDN)`}))),
  ]
  if (collection === '$storageConsumers') return [
    ...project.components.filter(c=>c.hosting!=='external').map(c=>({id:c.id,name:`${c.name || c.id} (${c.product})`})),
    ...project.design.workloads.map(r=>({id:r.id,name:`${r.values.name || r.id} (workload)`})),
    ...(project.sdn.scope==='none'?[]:project.design.sdnResources.filter(r=>r.values.role!=='hostcontroller').map(r=>({id:r.id,name:`${r.values.name || r.id} (SDN)`}))),
  ]
  const components = project.components.map(c => ({ id: c.id, name: `${c.name || c.id} (${c.product})` }))
  if (collection === '$components') return components
  const keys = collection === '$resources' ? resourceCollections : [collection]
  const records = keys.flatMap(key => (sdnCollectionKeys.includes(key) && project.sdn.scope === 'none' ? [] : project.design[key] ?? []).map(row => ({ id: row.id, name: `${String(row.values.name || row.id)}${collection === '$resources' ? ` (${key})` : ''}` })))
  return collection === '$resources' ? [...components, ...records] : records
}
