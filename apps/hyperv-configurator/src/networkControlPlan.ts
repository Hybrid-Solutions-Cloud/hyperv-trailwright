import type {Project} from './project'
import type {DesignRecord} from './catalog'
import type {Finding} from './validation'
import {parseIds} from './stagePlan'
const s=(r:DesignRecord,k:string)=>String(r.values[k]??'').trim()
const norm=(r:DesignRecord,k:string)=>s(r,k).toLowerCase()
const guid=(value:string)=>/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)&&!/^0{8}(-0{4}){3}-0{12}$/.test(value)
export function priorities(value:string):number[]|null{
 if(!value.trim())return []
 const values=new Set<number>()
 for(const token of value.trim().split(/[\s,;]+/)){const match=/^([0-7])(?:-([0-7]))?$/.exec(token);if(!match)return null;const first=Number(match[1]),last=Number(match[2]??match[1]);if(first>last)return null;for(let i=first;i<=last;i++)values.add(i)}
 return [...values].sort((a,b)=>a-b)
}
export function networkControlPlan(project:Project){
 const findings:Finding[]=[]
 const add=(code:string,row:DesignRecord,fieldKey:string,message:string,severity:Finding['severity']='error')=>findings.push({code,section:'network',recordId:row.id,fieldKey,message,severity})
 const rows=(key:string)=>[...project.design[key]].sort((a,b)=>a.id.localeCompare(b.id))
 const switches=rows('hostSwitches'),members=rows('switchMembers'),interfaces=rows('hostVnics'),classes=rows('networkTrafficClasses'),adapters=rows('adapters'),networks=rows('networks')
 const get=(key:string,id:string)=>project.design[key].find(r=>r.id===id)
 const missing=(row:DesignRecord,key:string,message:string)=>{if(!s(row,key))add('NETWORK_CONTROL_REVIEW',row,key,message,'warning')}
 for(const [key,fields]of [['hostSwitches',['vmmLogicalSwitchId']],['switchMembers',['vmmUplinkProfileSetId','vmmUplinkProfileId']],['hostVnics',['vmmPortClassificationId']],['networks',['vmmLogicalNetworkId','vmmNetworkSiteId','vmmIpPoolId']]] as const)for(const row of rows(key))for(const field of fields)if(s(row,field)&&!guid(s(row,field)))add('NETWORK_VMM_GUID',row,field,'Record a nonzero VMM object GUID; names and credential references are not object identities.')
 for(const sw of switches){
  const ports=members.filter(m=>m.values.switch===sw.id)
  if((sw.values.mode==='set'||sw.values.mode==='atc'&&sw.values.compute)&&ports.length>8)add('NETWORK_SET_LIMIT',sw,'mode','A SET team supports at most eight physical adapters.')
  if(sw.values.mode==='set')missing(sw,'loadBalancing','Select the SET load-balancing algorithm and verify switch-independent physical connectivity.')
  if(sw.values.management&&sw.values.action!=='preserve')missing(sw,'managementRecovery','Record management connectivity preservation and an independent recovery path before changing host networking.')
  if(sw.values.authority==='vmm'){
   const service=project.components.find(c=>c.id===sw.values.vmmService)
   if(service&&service.product!=='vmm')add('NETWORK_VMM_SERVICE',sw,'vmmService','The selected network owner must be an active VMM service.')
   for(const key of ['vmmService','vmmSwitchState','vmmSwitchReview'])missing(sw,key,'Record the VMM owner, logical-switch definition and settings acceptance.')
   if(sw.values.vmmSwitchState==='existing')missing(sw,'vmmLogicalSwitchId','Record the exact existing VMM logical switch ID.')
   if(sw.values.vmmSwitchState==='create'&&s(sw,'vmmLogicalSwitchId'))add('NETWORK_VMM_SWITCH_CREATION',sw,'vmmLogicalSwitchId','A new logical-switch definition cannot already carry an existing native VMM object ID.')
   for(const member of ports){for(const key of ['vmmUplinkProfileSetId','vmmUplinkProfileId','vmmUplinkReview'])missing(member,key,'Record the selected uplink profile/set and its logical-switch/network-site acceptance.')}
   if(sw.values.mode==='set'&&new Set(ports.map(p=>norm(p,'vmmUplinkProfileSetId')).filter(Boolean)).size>1)add('NETWORK_VMM_TEAM_PROFILE',sw,'vmmSwitchReview','Members of the same VMM SET team require the same selected uplink port-profile set.')
  }
 }
 for(const network of networks)if(network.values.authority==='vmm'){
  const service=project.components.find(c=>c.id===network.values.vmmService)
  if(service&&service.product!=='vmm')add('NETWORK_VMM_SERVICE',network,'vmmService','The selected network owner must be an active VMM service.')
  for(const key of ['vmmService','vmmLogicalNetworkState','vmmNetworkSiteState','vmmIsolation','vmmHostGroupIds','vmmNetworkReview'])missing(network,key,'Record logical-network, site and host-group scope in the owning VMM service.')
  if(s(network,'poolStart')&&s(network,'poolEnd'))missing(network,'vmmIpPoolState','Select an existing VMM address pool or a new pool definition.')
  for(const [state,id]of [['vmmLogicalNetworkState','vmmLogicalNetworkId'],['vmmNetworkSiteState','vmmNetworkSiteId'],['vmmIpPoolState','vmmIpPoolId']]){
   if(network.values[state]==='existing')missing(network,id,'Record the existing VMM object identity.')
   if(network.values[state]==='create'&&s(network,id))add('NETWORK_VMM_OBJECT_CREATION',network,id,'A new VMM definition cannot carry an existing native object ID.')
  }
  if(s(network,'vmmHostGroupIds')){try{const ids=parseIds(network.values.vmmHostGroupIds);if(!ids.length||ids.some(id=>!guid(id))||new Set(ids.map(id=>id.toLowerCase())).size!==ids.length)throw new Error()}catch{add('NETWORK_VMM_HOST_GROUPS',network,'vmmHostGroupIds','Use unique nonzero VMM host-group GUIDs, separated by spaces or in a JSON array.')}}
  if(network.values.vmmIsolation==='virtualized'&&project.sdn.scope==='none')add('NETWORK_VMM_ISOLATION',network,'vmmIsolation','Network virtualization requires an explicit SDN design and qualified deployment owner.')
 }
 const summaries=rows('hosts').flatMap(host=>{
  const hostClasses=classes.filter(c=>c.values.host===host.id);if(!hostClasses.length)return []
  const seenPriorities=new Map<number,string>(),names=new Set<string>();let bandwidth=0
  for(const c of hostClasses){
   const parsed=priorities(s(c,'priorities'))
   if(!parsed?.length)add('NETWORK_QOS_PRIORITIES',c,'priorities','Assign at least one 802.1p priority from 0 through 7 using IDs or ascending ranges.')
   for(const p of parsed||[]){if(seenPriorities.has(p))add('NETWORK_QOS_PRIORITY_OWNER',c,'priorities','Each host priority can map to only one traffic class.');seenPriorities.set(p,c.id)}
   if(names.has(norm(c,'name')))add('NETWORK_QOS_NAME',c,'name','Traffic class names must be unique on this host.');names.add(norm(c,'name'))
   const percent=Number(c.values.bandwidthPercent)
   if(!Number.isInteger(percent)||percent<0||percent>100)add('NETWORK_QOS_PERCENT',c,'bandwidthPercent','Traffic-class bandwidth must be a whole percentage from 0 through 100.')
   if(c.values.algorithm==='strict'&&percent!==0)add('NETWORK_QOS_STRICT_BANDWIDTH',c,'bandwidthPercent','Strict-priority classes do not have an ETS reservation; record zero for this field.')
   if(c.values.algorithm==='ets')bandwidth+=percent
   missing(c,'classification','Record the actual traffic classification and packet-marking policy.')
   missing(c,'physicalAcceptance','Record physical NIC/switch capability, DCBX ownership and end-to-end QoS acceptance.')
  }
  const first=hostClasses[0]
  if(hostClasses.filter(c=>c.values.kind==='default').length!==1)add('NETWORK_QOS_DEFAULT',first,'kind','Include exactly one representation of the built-in default traffic class.')
  if(hostClasses.length>8)add('NETWORK_QOS_CLASS_LIMIT',first,'kind','Windows DCB supports the default traffic class and at most seven additional classes; hardware can support fewer.')
  if(bandwidth>100)add('NETWORK_QOS_BUDGET',first,'bandwidthPercent','Unique host traffic-class ETS reservations exceed 100 percent.')
  if(bandwidth<100||seenPriorities.size<8)add('NETWORK_QOS_COVERAGE',first,'priorities','Review unallocated bandwidth and priorities, including their mapping to the default traffic class.','warning')
  if(new Set(hostClasses.map(c=>s(c,'authority')).filter(Boolean)).size>1)add('NETWORK_QOS_WRITER',first,'authority','Host traffic classes require one coordinated configuration owner.')
  for(const adapter of adapters.filter(a=>a.values.host===host.id&&['roce','iwarp'].includes(s(a,'rdma')))){
   const limit=Number(adapter.values.supportedTrafficClasses)
   if(limit>0&&hostClasses.length>limit)add('NETWORK_QOS_NIC_LIMIT',adapter,'supportedTrafficClasses','The planned host traffic-class count exceeds this NIC capability.')
   if(!limit)add('NETWORK_QOS_NIC_REVIEW',adapter,'supportedTrafficClasses','Qualify the NIC traffic-class capability before applying the host DCB policy.','warning')
   if(adapter.values.dcbxAuthority==='switch'&&hostClasses.some(c=>c.values.authority!=='existing'))add('NETWORK_DCBX_OWNER',adapter,'dcbxAuthority','A switch-controlled DCBX configuration conflicts with a host configuration writer.')
  }
  return [{hostId:host.id,hostName:s(host,'name'),classCount:hostClasses.length,etsBandwidthPercent:bandwidth,priorityCount:seenPriorities.size,runtimeQualified:false}]
 })
 for(const nic of interfaces){
  const trafficClass=get('networkTrafficClasses',s(nic,'trafficClass')),sw=get('hostSwitches',s(nic,'switch'))
  if(sw?.values.authority==='vmm')for(const key of ['vmmPortClassificationId','vmmPortReview'])missing(nic,key,'Record the virtual port classification and its profile acceptance in VMM.')
  if(trafficClass){
   if(trafficClass.values.host!==nic.values.host)add('NETWORK_QOS_INTERFACE_HOST',nic,'trafficClass','The interface traffic class must belong to the same physical host.')
   if(!priorities(s(trafficClass,'priorities'))?.includes(Number(nic.values.priority)))add('NETWORK_QOS_INTERFACE_PRIORITY',nic,'priority','The interface priority must map to its selected traffic class.')
   if(nic.values.pfc&&nic.values.pfc!==trafficClass.values.pfc)add('NETWORK_QOS_INTERFACE_PFC',nic,'pfc','The interface and traffic class must agree on priority flow control.')
   if(Number(nic.values.bandwidthPercent)!==Number(trafficClass.values.bandwidthPercent))add('NETWORK_QOS_INTERFACE_BANDWIDTH',nic,'bandwidthPercent','The interface record must agree with the shared class reservation; repeated vNICs do not add another reservation.')
   if(sw&&s(sw,'authority')!==s(trafficClass,'authority'))add('NETWORK_QOS_SWITCH_OWNER',nic,'trafficClass','The switch/intent and selected traffic class require a coordinated owner.')
  }else if(nic.values.rdma==='roce')missing(nic,'trafficClass','Map RoCE traffic to its host DCB/PFC class before end-to-end review.')
 }
 return {kind:'hyperv-network-control-plan',version:'0.1.0',projectId:project.id,revision:project.revision,runtimeQualified:false,trafficClasses:classes,qos:summaries,findings,sources:['https://learn.microsoft.com/en-us/system-center/vmm/network-switch?view=sc-vmm-2025','https://learn.microsoft.com/en-us/system-center/vmm/network-port-profile?view=sc-vmm-2025','https://learn.microsoft.com/en-us/system-center/vmm/hyper-v-network?view=sc-vmm-2025','https://learn.microsoft.com/en-us/powershell/module/dcbqos/new-netqostrafficclass?view=windowsserver2025-ps','https://learn.microsoft.com/en-us/windows-server/networking/sdn/technologies/hyper-v-network-virtualization/whats-new-hyperv-network-virtualization-windows-server']}
}
export function networkQosSchedule(project:Project){return networkControlPlan(project).qos.map(q=>({Host:q.hostName,HostId:q.hostId,TrafficClasses:q.classCount,EtsBandwidthPercent:q.etsBandwidthPercent,AssignedPriorities:q.priorityCount,RuntimeQualified:'No'}))}
