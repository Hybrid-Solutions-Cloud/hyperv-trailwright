import { collections, newRecord, type Answers } from '../catalog'
import { newProject } from '../project'
export function clusterFixture() {
  const project=newProject()
  const add=(key:string,id:string,values:Answers)=>{const row=newRecord(collections.find(c=>c.key===key)!);row.id=id;row.values={...row.values,...values};project.design[key].push(row);return row}
  add('sites','site-a',{name:'Example site'})
  const network=add('networks','net-a',{name:'Management',purpose:'management',site:'site-a',cidr:'192.0.2.0/24'})
  const cluster=add('clusters','cluster-a',{name:'example-cl',fqdn:'example-cl.example.test',domainFqdn:'example.test',address:'192.0.2.10',site:'site-a',managementNetwork:'net-a',seedHost:'host-1',clusterModuleVersion:'2.0.0.0',os:'ws2025',build:'10.0.26100.1000',intent:'package',authority:'native',lifecycle:'create',startingState:'ready',topology:'cluster'})
  const nodes=[1,2].map(i=>add('hosts',`host-${i}`,{name:`example-hv0${i}`,fqdn:`example-hv0${i}.example.test`,cluster:'cluster-a',uuid:`${i}${i}${i}${i}${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${String(i).repeat(12)}`,managementIp:`192.0.2.${10+i}`,lifecycle:'configure'}))
  cluster.values.administrativeAccessPoint='adDns'
  for(const host of nodes)Object.assign(host.values,{currentState:'ready',osAction:'preserve',osOwner:'preserve',hostRoleAction:'preserve',hostRoleOwner:'preserve',clusterAction:'join',clusterJoinOwner:'native',inventoryObservedAt:'2026-09-11T12:00:00Z',inventoryEvidence:'EXAMPLE physical inventory'})
  return {project,cluster,nodes,network}
}
