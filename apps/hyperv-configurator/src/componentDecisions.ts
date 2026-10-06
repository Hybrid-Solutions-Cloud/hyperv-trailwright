import {visibleField,type Field} from './catalog'
import type {Project} from './project'
import type {Finding} from './validation'
import {decisionGates,networkDecisionFields,operationsDecisionFields,switchedStorageKeys,FIREWALL,TOR,OOB,type DecisionGate} from './componentDecisionFields'

const answer=(project:Project,key:DecisionGate)=>String(project.decisions?.[key]??'')

/** Whether a component is in use. An unanswered gate is not in use for exports; its questions stay visible until answered. */
export function componentUsed(project:Project,component:'fortigate'|'customerFirewall'|'firewall'|'s2sVpn'|'p2sVpn'|'expressRoute'|'tor'|'oob'|'opengear'|'backup'|'monitoring'):boolean{
  switch(component){
    case 'fortigate':return answer(project,'firewallProvider')==='tierpoint-fortigate'
    case 'customerFirewall':return answer(project,'firewallProvider')==='customer'
    case 'firewall':return FIREWALL.includes(answer(project,'firewallProvider'))
    case 's2sVpn':return answer(project,'siteToSiteVpn')==='yes'
    case 'p2sVpn':return answer(project,'pointToSiteVpn')==='yes'
    case 'expressRoute':return answer(project,'expressRoute')==='yes'
    case 'tor':return TOR.includes(answer(project,'torProvider'))
    case 'oob':return OOB.includes(answer(project,'oobModel'))
    case 'opengear':return answer(project,'oobModel')==='opengear'
    case 'backup':return answer(project,'backupInScope')==='yes'
    case 'monitoring':return answer(project,'monitoringInScope')==='yes'
  }
}
/** Explicit "not used" answers. Operations records keep their existing questions until backup or monitoring is declined. */
export const backupDeclined=(project:Project)=>answer(project,'backupInScope')==='no'
export const monitoringDeclined=(project:Project)=>answer(project,'monitoringInScope')==='no'

/** An S2D storage system whose storage traffic crosses the ToR switches. */
export function switchedStorage(project:Project):boolean{
  return project.design.storageSystems.some(s=>s.values.kind==='s2d'&&s.values.storageConnectivity==='switched')
}

/** S2D storage systems whose storage traffic uses direct node-to-node cables. */
export function switchlessStorageSystems(project:Project){
  return project.design.storageSystems.filter(s=>s.values.kind==='s2d'&&s.values.storageConnectivity==='switchless')
}
/** Cable-map records that belong to a switchless S2D system. Links for a system that is no longer switchless stay saved but are not exported. */
export function activeStorageLinks(project:Project){
  const systems=new Set(switchlessStorageSystems(project).map(s=>s.id))
  return (project.design.storageLinks??[]).filter(l=>systems.has(String(l.values.storageSystem)))
}

/** Gate-level decision record shared by infrastructure.yml and the design schedules. A missing gate key is unanswered (null), not used. */
export function decisionRecord(project:Project){
  const d=project.decisions,s=(value:unknown)=>String(value??'').trim(),rows=(key:string)=>project.design[key]??[]
  const gate=(key:DecisionGate,used:boolean):{answer:string|null;used:boolean}=>key in d?{answer:s(d[key])||'unanswered',used}:{answer:null,used:false}
  return {
    management_plane:{answer:project.scope,management_source:project.context.managementSource||'unanswered',used:project.scope!=='cluster'},
    firewall:gate('firewallProvider',componentUsed(project,'firewall')),
    site_to_site_vpn:gate('siteToSiteVpn',componentUsed(project,'s2sVpn')),point_to_site_vpn:gate('pointToSiteVpn',componentUsed(project,'p2sVpn')),expressroute:gate('expressRoute',componentUsed(project,'expressRoute')),
    tor_switches:gate('torProvider',componentUsed(project,'tor')),out_of_band_management:gate('oobModel',componentUsed(project,'oob')),
    storage:rows('storageSystems').map(r=>({system:s(r.values.name)||r.id,answer:s(r.values.kind)||'unanswered',connectivity:r.values.kind==='s2d'?s(r.values.storageConnectivity)||'unanswered':undefined,used:true})),
    sdn:{answer:project.sdn.scope,used:project.sdn.scope!=='none'},
    cluster_witness:rows('clusters').map(r=>({cluster:s(r.values.name)||r.id,answer:s(r.values.witness)||'unanswered',used:['file','cloud','disk'].includes(s(r.values.witness))})),
    backup:gate('backupInScope',componentUsed(project,'backup')),monitoring:gate('monitoringInScope',componentUsed(project,'monitoring')),
  }
}

/** Decision fields that currently apply in a section: the gate answer reveals its follow-up questions. */
export function activeDecisionFields(project:Project,section:'network'|'operations'):Field[]{
  const fields=section==='network'?networkDecisionFields:operationsDecisionFields
  return fields.filter(f=>visibleField(f,project.decisions)&&(!switchedStorageKeys.includes(f.key)||switchedStorage(project)))
}
export const allActiveDecisionFields=(project:Project)=>[...activeDecisionFields(project,'network'),...activeDecisionFields(project,'operations')]

/** Record fields hidden by a project-level component decision. The values stay in the saved record. */
export function decisionHiddenFields(project:Project,collectionKey:string):Set<string>{
  const hidden=new Set<string>()
  const hide=(condition:boolean,...keys:string[])=>{if(condition)for(const key of keys)hidden.add(key)}
  const tor=componentUsed(project,'tor'),oob=componentUsed(project,'oob'),opengear=componentUsed(project,'opengear')
  if(collectionKey==='adapters')hide(!tor,'torSwitch','torPort')
  if(collectionKey==='hosts')hide(!oob,'bmcOobDevice','bmcOobPort')
  if(collectionKey==='firewallInterfaces')hide(!tor,'torSwitch','torPort')
  if(collectionKey==='consolePorts'){hide(!tor,'targetTor');hide(!componentUsed(project,'fortigate'),'targetFirewall')}
  if(collectionKey==='oobDevices'){hide(opengear,'vendor');hide(!opengear,'serialPortCount','cellularFailover','cellularApn')}
  if(collectionKey==='operations'){
    hide(backupDeclined(project),'backup','backupMode','backupOwner','backupProvider','backupRepository','backupCredentialRef','backupIntervalMinutes','backupRetentionDays','backupConsistency','backupProtection','backupException')
    hide(monitoringDeclined(project),'monitoring','managementPacks','retentionDays','monitoringTool','scomComponent','discoveryAcceptance','alertOwner','alertRoute')
  }
  if(collectionKey==='operationsTargets'){hide(backupDeclined(project),'backup');hide(monitoringDeclined(project),'monitoring')}
  return hidden
}

const SOURCES={
  s2d:'https://learn.microsoft.com/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements#network',
  switchless:'https://learn.microsoft.com/azure/architecture/hybrid/azure-local-switchless#cluster-design-choices',
}

/**
 * The Windows Server switchless full-mesh cable map: every pair of nodes in the cluster has exactly the chosen number
 * of direct links, no link joins a node to itself, each adapter port carries one link, and each adapter belongs to its node.
 */
function cableMapFindings(project:Project,system:Project['design'][string][number],nodes:Project['design'][string]):Finding[]{
  const findings:Finding[]=[],v=system.values,label=String(v.name||'S2D system'),expected=Number(v.switchlessLinks)||1
  const links=activeStorageLinks(project).filter(l=>l.values.storageSystem===system.id)
  const hostName=(id:unknown)=>String(project.design.hosts.find(h=>h.id===id)?.values.name||id||'Node')
  const add=(code:string,message:string,recordId:string,fieldKey:string,severity:Finding['severity']='error')=>findings.push({code,section:'storage',recordId,fieldKey,severity,message})
  if(nodes.length<2)return findings
  if(!links.length){add('S2D_SWITCHLESS_CABLE_MAP',`${label}: record the switchless cable map — ${expected} direct link${expected>1?'s':''} for each of the ${nodes.length*(nodes.length-1)/2} node pairs. ${SOURCES.s2d}`,system.id,'storageConnectivity','warning');return findings}
  const members=new Set(nodes.map(h=>h.id)),ports=new Map<string,string>(),pairs=new Map<string,{count:number;indexes:Set<number>}>()
  for(const link of links){
    const x=link.values,a=String(x.hostA),b=String(x.hostB),name=String(x.name||'Storage link')
    if(!x.hostA||!x.hostB)continue
    if(a===b){add('S2D_SWITCHLESS_SELF_LINK',`${name}: a switchless storage link must join two different nodes; both ends are ${hostName(a)}.`,link.id,'hostB');continue}
    for(const [host,key] of [[a,'hostA'],[b,'hostB']] as const)if(!members.has(host))add('S2D_SWITCHLESS_LINK_HOST',`${name}: ${hostName(host)} is not a node in the cluster of ${label}.`,link.id,key)
    for(const [host,adapterKey,portKey] of [[a,'adapterA','portA'],[b,'adapterB','portB']] as const){
      const adapter=project.design.adapters.find(r=>r.id===x[adapterKey])
      if(!adapter)continue
      if(adapter.values.host!==host)add('S2D_SWITCHLESS_LINK_ADAPTER',`${name}: adapter ${String(adapter.values.name||adapter.id)} does not belong to ${hostName(host)}.`,link.id,adapterKey)
      const port=`${adapter.id}|${String(x[portKey]??'').trim().toLowerCase()}`
      if(ports.has(port))add('S2D_SWITCHLESS_PORT_REUSE',`${name}: ${hostName(host)} adapter ${String(adapter.values.name||adapter.id)}${x[portKey]?` port ${String(x[portKey])}`:''} is already used by ${ports.get(port)}. Each storage port carries one direct link.`,link.id,adapterKey)
      else ports.set(port,name)
    }
    const pair=[a,b].sort().join('|'),entry=pairs.get(pair)??{count:0,indexes:new Set<number>()},index=Number(x.linkIndex)||0
    if(index&&entry.indexes.has(index))add('S2D_SWITCHLESS_LINK_INDEX',`${name}: link number ${index} is already recorded for ${hostName(a)} and ${hostName(b)}.`,link.id,'linkIndex')
    entry.count++;if(index)entry.indexes.add(index);pairs.set(pair,entry)
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const count=pairs.get([nodes[i].id,nodes[j].id].sort().join('|'))?.count??0
    if(count!==expected)add('S2D_SWITCHLESS_MESH',`${label}: ${hostName(nodes[i].id)} and ${hostName(nodes[j].id)} have ${count} direct storage link${count===1?'':'s'}; the full mesh needs ${expected}. Every node needs a direct connection to every other node.`,system.id,'switchlessLinks')
  }
  return findings
}

/** Unanswered gates, missing required follow-ups and the S2D switchless full-mesh rule. */
export function decisionFindings(project:Project):Finding[]{
  const findings:Finding[]=[]
  for(const [key,gate] of Object.entries(decisionGates)){
    if(!answer(project,key as DecisionGate))findings.push({code:'COMPONENT_DECISION',section:gate.section,fieldKey:key,severity:'error',message:`Decide whether ${gate.component.replace(/_/g,' ')} is used in this design.`})
  }
  for(const section of ['network','operations'] as const)for(const field of activeDecisionFields(project,section)){
    if(field.required&&!(field.key in decisionGates)&&!String(project.decisions[field.key]??'').trim())findings.push({code:'COMPONENT_DETAIL',section,fieldKey:field.key,severity:'error',message:`${field.label} is required for the selected component.`})
  }
  for(const system of project.design.storageSystems){
    const v=system.values
    if(v.kind!=='s2d'||v.storageConnectivity!=='switchless')continue
    const nodes=project.design.hosts.filter(h=>h.values.cluster===v.cluster)
    const links=Number(v.switchlessLinks)||1,portsPerNode=Math.max(nodes.length-1,0)*links
    if(nodes.length>4)findings.push({code:'S2D_SWITCHLESS_SCALE',section:'storage',recordId:system.id,fieldKey:'storageConnectivity',severity:'warning',message:`${v.name||'S2D system'}: switchless storage needs a direct link from every node to every other node (${portsPerNode} storage ports per node for ${nodes.length} nodes). Microsoft documents validated switchless designs only up to four nodes. Review a switched design. ${SOURCES.s2d} ${SOURCES.switchless}`})
    const storageNetworks=new Set(project.design.networks.filter(n=>n.values.purpose==='storage').map(n=>n.id))
    for(const host of nodes){
      const ports=project.design.adapters.filter(a=>a.values.host===host.id&&storageNetworks.has(String(a.values.network))).length
      if(ports&&ports<portsPerNode)findings.push({code:'S2D_SWITCHLESS_PORTS',section:'storage',recordId:system.id,fieldKey:'storageConnectivity',severity:'error',message:`${host.values.name||'Host'}: switchless storage with ${nodes.length} nodes needs ${portsPerNode} direct storage ports; ${ports} storage adapters are recorded. Every node needs a direct connection to every other node.`})
    }
    findings.push(...cableMapFindings(project,system,nodes))
  }
  return findings
}
