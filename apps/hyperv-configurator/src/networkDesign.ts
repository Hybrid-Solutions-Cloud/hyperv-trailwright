import type {Project} from './project'
import type {DesignRecord} from './catalog'
import type {Finding} from './validation'
import {cidr,ipv4,dnsOrIpv4} from './networkAddress'
import {networkControlPlan} from './networkControlPlan'
import {networkKnownAddresses} from './networkKnownAddresses'
const s=(r:DesignRecord,key:string)=>String(r.values[key]??'').trim()
const normalized=(r:DesignRecord,key:string)=>s(r,key).toLowerCase()
const rows=(p:Project,key:string)=>[...p.design[key]].sort((a,b)=>a.id.localeCompare(b.id))
type Interval={first:number;last:number}
type Allocation=Interval&{row:DesignRecord;network:DesignRecord|undefined;scope:string;targetId:string;kind:string;exclusion:string;fieldKey:string;section:string;origin:'assignment'|'host'|'component'|'cluster'|'sdn'|'sdnFabric'|'sdnFrontend'}
export function intervalSize(input:Interval[]):number{
 const sorted=input.filter(r=>r.first<=r.last).sort((a,b)=>a.first-b.first);let total=0,end=-1
 for(const r of sorted){total+=Math.max(0,r.last-Math.max(end,r.first-1));end=Math.max(end,r.last)}return total
}
export function vlanList(value:string):number[]|null{
 if(!value.trim())return []
 const out=new Set<number>()
 for(const token of value.trim().split(/[,;\s]+/)){const m=/^(\d{1,4})(?:-(\d{1,4}))?$/.exec(token);if(!m)return null;const start=Number(m[1]),end=Number(m[2]??m[1]);if(start>end||end>4094)return null;for(let n=start;n<=end;n++)out.add(n)}
 return [...out].sort((a,b)=>a-b)
}
export function networkDesign(project:Project){
 const findings:Finding[]=[]
 const controls=networkControlPlan(project),known=networkKnownAddresses(project)
 findings.push(...controls.findings,...known.findings)
 const add=(code:string,row:DesignRecord,fieldKey:string,message:string,severity:Finding['severity']='error')=>findings.push({code,section:'network',recordId:row.id,fieldKey,message,severity})
 const switches=rows(project,'hostSwitches'),members=rows(project,'switchMembers'),interfaces=rows(project,'hostVnics'),assignments=rows(project,'addressAssignments'),networks=rows(project,'networks'),adapters=rows(project,'adapters')
 const get=(key:string,id:string)=>project.design[key].find(r=>r.id===id)
 const memberAdapters=(id:string)=>members.filter(r=>s(r,'switch')===id).map(r=>get('adapters',s(r,'adapter'))).filter((r):r is DesignRecord=>!!r)
 for(const a of adapters){
  if(vlanList(s(a,'allowedVlans'))===null)add('NETWORK_VLAN_LIST',a,'allowedVlans','Use VLAN IDs 0–4094 or ascending ranges separated by commas.')
  if(s(a,'mtu')&&Number(a.values.mtu)>0&&!Number.isInteger(a.values.mtu))add('NETWORK_INTEGER',a,'mtu','MTU must be a whole number.')
  if(s(a,'nativeName')&&adapters.some(b=>b.id!==a.id&&s(a,'host')===s(b,'host')&&normalized(a,'nativeName')===normalized(b,'nativeName')))add('NETWORK_ADAPTER_NAME',a,'nativeName','Physical adapter names must be unique on their host.')
 }
 for(const member of members){
  const sw=get('hostSwitches',s(member,'switch')),a=get('adapters',s(member,'adapter'));if(!sw||!a)continue
  if(s(sw,'host')!==s(a,'host'))add('NETWORK_MEMBER_HOST',member,'adapter','Switch members must belong to the switch or intent host.')
  if(members.some(m=>m.id!==member.id&&s(m,'adapter')===a.id))add('NETWORK_MEMBER_REUSE',member,'adapter','A physical adapter can be assigned to only one switch or intent, once.')
  if(s(a,'authority')&&s(a,'authority')!==s(sw,'authority'))add('NETWORK_WRITER',a,'authority','The adapter and its switch or intent must have one configuration owner.')
  if(s(a,'switchName')&&normalized(a,'switchName')!==normalized(sw,'name'))add('NETWORK_LEGACY_SWITCH',member,'adapter','The typed switch mapping conflicts with the existing adapter switch name; reconcile the recorded baseline.')
 }
 for(const sw of switches){
  const v=sw.values,host=get('hosts',s(sw,'host')),ports=memberAdapters(sw.id)
  if(switches.some(other=>other.id!==sw.id&&s(other,'host')===s(sw,'host')&&normalized(other,'name')===normalized(sw,'name')))add('NETWORK_SWITCH_IDENTITY',sw,'name','A host switch or intent name must identify one record and one writer.')
  if(!ports.length)add('NETWORK_MEMBERS_REQUIRED',sw,'mode','Link exact physical adapter members to this switch or intent.','warning')
  if(v.mode==='single'&&ports.length>1)add('NETWORK_SINGLE_MEMBER',sw,'mode','A single-adapter external switch cannot have multiple physical members.')
  if(v.action!=='preserve'&&(v.mode==='atc')!==(v.authority==='atc'))add('NETWORK_ATC_OWNER',sw,'authority','Network ATC mode and configuration ownership must agree.')
  if(v.action==='preserve'&&v.authority!=='existing')add('NETWORK_PRESERVE_OWNER',sw,'authority','A preserved network must retain the existing fabric owner without a configuration writer.')
  if(v.action!=='preserve'&&v.authority==='existing')add('NETWORK_CHANGE_OWNER',sw,'authority','Select an explicit configuration owner for a network change.')
  if(v.action==='create'&&s(sw,'nativeId'))add('NETWORK_EXISTING_ID',sw,'nativeId','Creating a network cannot silently reuse an existing switch or intent identity.')
  if(['preserve','configure','replace'].includes(s(sw,'action'))&&(!s(sw,'nativeId')||!s(sw,'baseline')))add('NETWORK_BASELINE',sw,'baseline','Record the native identity and observed baseline of the existing network.','warning')
  if(v.action==='replace'&&(!s(sw,'replacement')||!s(sw,'changeWindow')))add('NETWORK_REPLACEMENT',sw,'replacement','Network replacement requires explicit approval, management recovery and a change window.')
  for(const key of ['physicalReview','acceptance'])if(!s(sw,key))add('NETWORK_ACCEPTANCE',sw,key,'Record physical-network prerequisites and connectivity, failover and rollback acceptance.','warning')
  if(v.mode==='atc'){
   if(host&&get('clusters',s(host,'cluster'))?.values.os!=='ws2025')add('NETWORK_ATC_OS',sw,'host','This Windows Server Network ATC path requires Windows Server 2025 and exact build qualification.')
   if(!v.management&&!v.compute&&!v.storage)add('NETWORK_ATC_TRAFFIC',sw,'management','Select at least one ATC traffic intent: management, compute or storage.')
   if(v.storage&&!s(sw,'storageAddressing'))add('NETWORK_ATC_ADDRESS_OWNER',sw,'storageAddressing','Choose ATC automatic or explicit operator storage addressing.','warning')
   const clusterId=host&&s(host,'cluster')
   if(!clusterId)add('NETWORK_ATC_CLUSTER',sw,'host','Record the physical cluster scope for cross-node ATC review.','warning')
   else for(const peer of project.design.hosts.filter(h=>s(h,'cluster')===clusterId&&h.id!==host.id)){
    const peerSwitch=switches.find(other=>s(other,'host')===peer.id&&normalized(other,'name')===normalized(sw,'name'))
    if(!peerSwitch){add('NETWORK_ATC_NODE_MISSING',sw,'name',`Intent ${s(sw,'name')} has no host instance for ${s(peer,'name')||peer.id}.`,'warning');continue}
    if(peerSwitch.values.mode!=='atc'||peerSwitch.values.authority!=='atc'||['management','compute','storage','storageAddressing'].some(k=>peerSwitch.values[k]!==v[k]))add('NETWORK_ATC_INTENT_SYMMETRY',sw,'name','The same cluster intent must have matching traffic and addressing ownership on every node.')
    const signature=(p:DesignRecord)=>['nativeName','manufacturer','modelId','speedGbps','driverVersion','firmwareVersion','rdma','mtu'].map(k=>normalized(p,k)).join('|')
    const remote=memberAdapters(peerSwitch.id)
    if(ports.length&&remote.length&&JSON.stringify(ports.map(signature).sort())!==JSON.stringify(remote.map(signature).sort()))add('NETWORK_ATC_NODE_SYMMETRY',sw,'name','Cluster intent members must have matching physical names, make, model, speed and configuration on every node.')
   }
  }
  if(['set','atc'].includes(s(sw,'mode'))){
   for(const key of ['manufacturer','modelId','speedGbps','driverVersion','firmwareVersion']){
    if(ports.some(p=>!s(p,key)||p.values[key]===0))add('NETWORK_NIC_REVIEW',sw,'mode',`Record ${key} for every physical member before symmetry review.`,'warning')
    if(new Set(ports.map(p=>normalized(p,key)).filter(Boolean)).size>1)add('NETWORK_NIC_SYMMETRY',sw,'mode',`Physical members require matching ${key}.`)
   }
   for(const p of ports)if(v.mode==='atc'&&p.values.linkState!=='up')add('NETWORK_ATC_LINK',p,'linkState','ATC requires an observed Up adapter link.',p.values.linkState==='down'?'error':'warning')
  }
  if(v.management&&!interfaces.some(i=>s(i,'switch')===sw.id&&get('networks',s(i,'network'))?.values.purpose==='management'))add('NETWORK_MANAGEMENT_INTERFACE',sw,'management','Map a host interface and address plan for management traffic.','warning')
 }
 for(const nic of interfaces){
  const v=nic.values,sw=get('hostSwitches',s(nic,'switch')),a=get('adapters',s(nic,'adapter')),net=get('networks',s(nic,'network')),ports=sw?memberAdapters(sw.id):a?[a]:[]
  if(!sw&&!a)add('NETWORK_INTERFACE_MAPPING',nic,'switch','Select an owning switch/intent or a direct physical adapter.','warning')
  if(sw&&s(sw,'host')!==s(nic,'host')||a&&s(a,'host')!==s(nic,'host'))add('NETWORK_INTERFACE_HOST',nic,'host','The host interface and its physical mapping must belong to the same host.')
  if(sw&&a&&!ports.some(p=>p.id===a.id))add('NETWORK_INTERFACE_MEMBER',nic,'adapter','The mapped physical adapter must be a member of the selected switch or intent.')
  for(const key of ['vlan','mtu','priority','bandwidthPercent'])if(typeof v[key]==='number'&&!Number.isInteger(v[key]))add('NETWORK_INTEGER',nic,key,'VLAN, MTU, priority and bandwidth percentages must be whole numbers.')
  if(net&&v.vlan!==net.values.vlan)add('NETWORK_INTERFACE_VLAN',nic,'vlan','Interface VLAN must match its traffic network.')
  if(net&&Number(v.mtu)>0&&Number(net.values.mtu)>0&&v.mtu!==net.values.mtu)add('NETWORK_MTU',nic,'mtu','Use a consistent IP MTU for the interface and traffic network; separately verify physical frame overhead.')
  for(const port of ports){const allowed=vlanList(s(port,'allowedVlans'));if(allowed?.length&&!allowed.includes(Number(v.vlan)))add('NETWORK_VLAN_TRUNK',nic,'vlan','The interface VLAN is missing from a physical member allowed-VLAN list.');if(v.rdma&&v.rdma!=='none'&&port.values.rdma!==v.rdma)add('NETWORK_RDMA_MEMBER',nic,'rdma','Host RDMA protocol must match its physical member configuration.')}
  if(v.rdma==='roce'&&(Number(v.vlan)<1||Number(v.vlan)>4094||v.pfc==='disabled'))add('NETWORK_ROCE',nic,'pfc','RoCE requires a tagged VLAN 1–4094 and priority flow control on the selected traffic priority.')
  if(v.rdma==='roce'&&v.pfc!=='enabled')add('NETWORK_PFC_REVIEW',nic,'pfc','Record end-to-end PFC and ETS configuration for RoCE.','warning')
  if(v.rdma&&v.rdma!=='none'&&!s(nic,'acceptance'))add('NETWORK_RDMA_ACCEPTANCE',nic,'acceptance','Record end-to-end NIC, switch QoS, RDMA and failure-path acceptance.','warning')
  if(sw?.values.mode==='atc'&&sw.values.storageAddressing==='automatic'&&net?.values.purpose==='storage'&&assignments.some(r=>s(r,'interface')===nic.id&&r.values.kind!=='exclusion'))add('NETWORK_ATC_IP_CONFLICT',nic,'switch','An ATC automatic storage interface cannot also have an operator static or DHCP address assignment.')
 }
 const typedAssignments=assignments.flatMap<Allocation>(r=>{
  const start=ipv4(s(r,'start')),end=r.values.kind==='exclusion'?ipv4(s(r,'end')||s(r,'start')):start,net=get('networks',s(r,'network')),range=net&&cidr(s(net,'cidr'))
  if(start===null||end===null||start>end){add('NETWORK_ASSIGNMENT_ADDRESS',r,'start','Enter valid IPv4 addresses in ascending order.');return []}
  if(r.values.kind!=='exclusion'&&s(r,'end'))add('NETWORK_SINGLE_ADDRESS',r,'end','Static and DHCP reservations allocate one address; use an exclusion for ranges.')
  if(range&&(start<=range.first||end>=range.last))add('NETWORK_ASSIGNMENT_SUBNET',r,'start','Assignments must be usable host addresses inside the selected subnet; network and broadcast addresses are reserved.')
  if(r.values.kind==='reservation'&&!s(r,'clientId'))add('NETWORK_DHCP_CLIENT',r,'clientId','A DHCP reservation needs an explicit client ID or MAC.','warning')
  if(r.values.kind==='reservation'&&net&&net.values.poolMode!=='dhcp')add('NETWORK_DHCP_OWNER',r,'kind','A DHCP reservation requires a DHCP-owned address pool.')
  const nic=get('hostVnics',s(r,'interface'))
  if(nic&&s(nic,'network')!==s(r,'network'))add('NETWORK_ASSIGNMENT_INTERFACE',r,'interface','Address and host interface must reference the same traffic network.')
  if(nic&&s(r,'resource')&&s(r,'resource')!==s(nic,'host'))add('NETWORK_ASSIGNMENT_RESOURCE',r,'resource','A host interface address must belong to that interface host.')
  return [{row:r,first:start,last:end,network:net,scope:net?(normalized(net,'routingScope')||net.id):s(r,'network'),targetId:s(r,'resource')||(nic?s(nic,'host'):''),kind:s(r,'kind'),exclusion:s(r,'exclusionPurpose')||'reserved',fieldKey:'start',section:'network',origin:'assignment'}]
 })
 const legacyAssignments:Allocation[]=known.addresses.map(a=>({row:a.source==='sdnFabric'?{id:a.recordId,values:{...project.sdn.details,name:'Controller REST endpoint'}}:get(({host:'hosts',component:'managementNetworks',cluster:'clusters',sdn:'sdnResources',sdnFrontend:'sdnFrontends'})[a.source],a.recordId)!,first:a.address,last:a.address,network:get('networks',a.networkId),scope:a.scope,targetId:a.targetId,kind:typedAssignments.some(t=>t.kind==='reservation'&&t.targetId&&t.targetId===a.targetId&&t.scope===a.scope&&t.first===a.address)?'reservation':'static',exclusion:'',fieldKey:a.fieldKey,section:a.section,origin:a.source}))
 const validAssignments=[...typedAssignments,...legacyAssignments].sort((a,b)=>a.row.id.localeCompare(b.row.id)||a.origin.localeCompare(b.origin))
 for(let i=0;i<validAssignments.length;i++)for(const b of validAssignments.slice(i+1)){
  const a=validAssignments[i]
  if(a.scope!==b.scope||a.first>b.last||b.first>a.last)continue
  if(a.kind==='exclusion'&&b.kind==='exclusion')continue
  if(a.kind==='exclusion'&&a.exclusion==='dhcp'&&b.kind==='static'||b.kind==='exclusion'&&b.exclusion==='dhcp'&&a.kind==='static')continue
  if(a.origin!==b.origin&&a.targetId&&a.targetId===b.targetId&&a.first===a.last&&a.first===b.first&&b.first===b.last)continue
  findings.push({code:'NETWORK_ADDRESS_COLLISION',section:b.section,recordId:b.row.id,fieldKey:b.fieldKey,severity:'error',message:`Address assignment overlaps ${s(a.row,'name')||a.row.id} in the same routing scope.`})
 }
 const pools=networks.map(net=>{
  const range=cidr(s(net,'cidr')),start=ipv4(s(net,'poolStart')),end=ipv4(s(net,'poolEnd')),gateway=ipv4(s(net,'gateway')),scoped=validAssignments.filter(a=>a.scope===(normalized(net,'routingScope')||net.id))
  if(!Number.isInteger(net.values.vlan)||Number(net.values.vlan)<0||Number(net.values.vlan)>4094)add('NETWORK_VLAN',net,'vlan','VLAN must be a whole number from 0 through 4094.')
  if(range&&gateway!==null&&(gateway<=range.first||gateway>=range.last))add('NETWORK_GATEWAY',net,'gateway','Gateway must be a usable host address in the subnet.')
  if(gateway!==null&&scoped.some(a=>a.kind!=='exclusion'&&a.first<=gateway&&a.last>=gateway))add('NETWORK_GATEWAY_COLLISION',net,'gateway','The default gateway is already assigned to a resource in this routing scope.')
  for(const key of ['dns','ntp'])if(s(net,key)&&s(net,key).split(/[,;\s]+/).some(value=>!dnsOrIpv4(value)))add('NETWORK_SERVICE_ADDRESS',net,key,'Use DNS names or IPv4 addresses separated by spaces or commas.')
  if((start===null)!==(end===null))add('NETWORK_POOL_BOUNDARY',net,'poolStart','Supply both valid pool boundaries.')
  const valid=!!range&&start!==null&&end!==null&&start<=end&&start>range.first&&end<range.last
  if(range&&start!==null&&end!==null&&!valid)add('NETWORK_POOL_USABLE',net,'poolStart','Pool boundaries must be ordered usable host addresses in the subnet.')
  const occupied=valid?scoped.map(a=>({first:Math.max(start!,a.first),last:Math.min(end!,a.last)})):[]
  if(valid&&gateway!==null&&gateway>=start!&&gateway<=end!)occupied.push({first:gateway,last:gateway})
  const total=valid?end!-start!+1:null,unavailable=valid?intervalSize(occupied):null
  if(valid&&total===unavailable)add('NETWORK_POOL_EXHAUSTED',net,'poolStart','Assignments, exclusions and the gateway consume the entire planned pool.')
  for(const a of typedAssignments.filter(a=>a.network?.id===net.id&&a.kind==='reservation'))if(!valid||a.first<start!||a.last>end!)add('NETWORK_RESERVATION_POOL',a.row,'start','DHCP reservation must be inside the declared usable DHCP pool.')
  if(valid&&net.values.poolMode==='dhcp')for(const a of scoped.filter(a=>a.kind==='static'&&a.first>=start!&&a.first<=end!))if(!scoped.some(e=>e.kind==='exclusion'&&e.exclusion==='dhcp'&&e.first<=a.first&&e.last>=a.last))findings.push({code:'NETWORK_STATIC_DHCP_CONFLICT',section:a.section,recordId:a.row.id,fieldKey:a.fieldKey,severity:'error',message:'Static allocation inside a DHCP pool requires an explicit DHCP-only exclusion, or use a DHCP reservation.'})
  return {id:net.id,name:s(net,'name'),routingScope:s(net,'routingScope'),totalAddresses:total,unavailableAddresses:unavailable,remainingAddresses:total===null?null:total-unavailable!,runtimeQualified:false}
 })
 return {kind:'hyperv-network-design',version:'0.2.0',projectId:project.id,projectRevision:project.revision,reviewedAt:'2026-09-11',runtimeQualified:false,sources:['https://learn.microsoft.com/en-us/windows-server/networking/network-atc/network-atc','https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements',...controls.sources],switches,members,interfaces,assignments,declaredAddresses:known.addresses,controls,pools,findings}
}
export function networkPoolSchedule(project:Project){return networkDesign(project).pools.map(p=>({Network:p.name,NetworkId:p.id,RoutingScope:p.routingScope,PoolAddresses:p.totalAddresses??'Unknown',UnavailableAddresses:p.unavailableAddresses??'Unknown',RemainingAddresses:p.remainingAddresses??'Unknown',RuntimeQualified:'No'}))}
