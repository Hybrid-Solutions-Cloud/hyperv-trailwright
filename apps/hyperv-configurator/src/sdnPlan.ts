import {sdnArchitecture} from './sdnArchitecture'
import {collections,visibleField,type Answers,type DesignRecord} from './catalog'
import type {Project} from './project'
import type {Finding} from './validation'
import {activeSdnFields,activeSdnDetails} from './sdnActiveFields'
import {sdnIntents,sdnCollectionKeys} from './sdnFields'
import {referenceOptions} from './references'
import {cidr,ipv4,dnsOrIpv4} from './networkAddress'
import {sdnServices} from './sdnServices'

const s=(v:Answers,k:string)=>String(v[k]??'').trim()
const changed=(v:Answers)=>['create','configure','expand','replace'].includes(s(v,'lifecycle'))
const sorted=(p:Project,key:string)=>[...p.design[key]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
export const SDN_SOURCES=[
 'https://learn.microsoft.com/en-us/windows-server/networking/sdn/deploy/deploy-network-controller-failover-clustering',
 'https://learn.microsoft.com/en-us/system-center/vmm/sdn-controller?view=sc-vmm-2025',
 'https://www.powershellgallery.com/packages/SdnExpress/1.1.245',
 'https://learn.microsoft.com/en-us/system-center/vmm/sdn-gateway?view=sc-vmm-2025',
]
export function sdnPlan(project:Project){
 const d=activeSdnDetails(project.sdn),active=project.sdn.scope!=='none',findings:Finding[]=[]
 const add=(code:string,fieldKey:string,message:string,row?:DesignRecord,severity:Finding['severity']='error')=>findings.push({code,section:'sdn',fieldKey,message,severity,...(row?{recordId:row.id}:{})})
 const resources=active?sorted(project,'sdnResources'):[],peers=active?sorted(project,'bgpPeers'):[],services=active?sorted(project,'tenantServices'):[],bindings=active?sorted(project,'sdnHostBindings'):[]
 const capabilities={isolation:active&&(!!d.isolation||services.some(r=>r.values.service==='network')),policy:active&&(!!d.policy||services.some(r=>r.values.service==='policy')),loadBalancing:active&&(project.sdn.loadBalancer||services.some(r=>r.values.service==='loadBalancer')),nat:active&&(!!d.nat||services.some(r=>r.values.service==='nat')),routing:active&&(!!d.routing||project.sdn.gateways||services.some(r=>r.values.service==='gateway')),tunnels:active&&(!!d.tunnels||services.some(r=>r.values.service==='gateway'&&!!s(r.values,'tunnel')))}
 const hostController=project.sdn.architecture==='host-cluster-role',needGateway=capabilities.routing||capabilities.tunnels||(active&&(project.design.sdnGatewayPools.length>0||project.design.sdnConnections.length>0))||resources.some(r=>r.values.role==='gateway'&&changed(r.values)),needMux=capabilities.loadBalancing||capabilities.nat||(needGateway&&project.sdn.owner==='vmm'),needProvider=capabilities.isolation||needMux||needGateway
 const requiredRoles=active?[hostController?'hostcontroller':'controller',...(needMux?['mux']:[]),...(needGateway?['gateway']:[])]:[]
 const required=(values:Answers,keys:string[],message:string,row?:DesignRecord)=>{for(const key of keys)if(!s(values,key))add('SDN_REQUIRED',key,message,row)}
 const inNetwork=(address:string,networkId:string)=>{const n=project.design.networks.find(n=>n.id===networkId),range=n&&cidr(s(n.values,'cidr')),ip=ipv4(address);return !!range&&ip!==null&&ip>=range.first&&ip<=range.last&&(range.prefix>=31||(ip>range.first&&ip<range.last))&&address!==s(n!.values,'gateway')}
 if(active){
  required(d,['intent','controllerCluster','managementNetwork',...(activeSdnFields(project.sdn).some(f=>f.key==='restIp')?['restIp']:[]),'restName','domainIdentity','controllerIdentity','runnerIdentity','certificateIdentity','macPoolStart','macPoolEnd','compatibilityEvidence','physicalAcceptance','availability','monitoring'],'Complete the SDN fabric, identity, physical and operational contract.')
  for(const f of activeSdnFields(project.sdn))if(f.collection&&d[f.key]&&!referenceOptions(project,f.collection).some(r=>r.id===d[f.key]))add('SDN_REFERENCE',f.key,`${f.label} references a removed or inactive resource.`)
  if(!project.sdn.osVersion.trim()||!project.sdn.toolVersion.trim()||!project.sdn.certificates.trim()||!project.sdn.recovery.trim())add('SDN_PREREQUISITES','osVersion','Record exact OS/tool versions, certificate design and recovery acceptance.')
  let endpoint:URL|undefined;try{endpoint=new URL(project.sdn.controllerEndpoint)}catch{/* Report below. */}
  if(!endpoint||endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)add('SDN_ENDPOINT','controllerEndpoint','Use an HTTPS controller endpoint without credentials, query parameters or fragments.')
  if(endpoint&&!([s(d,'restName'),s(d,'restIp')].map(v=>v.toLowerCase()).includes(endpoint.hostname.toLowerCase())))add('SDN_ENDPOINT_IDENTITY','controllerEndpoint','The controller endpoint hostname must match the declared REST DNS name or address.')
  for(const [key,kinds]of [['domainIdentity',['domain']],['controllerIdentity',['service','gmsa']],['runnerIdentity',['runner','service','gmsa']],['certificateIdentity',['pki']]] as const){const identity=project.design.identities.find(r=>r.id===d[key]);if(identity&&!kinds.some(kind=>kind===identity.values.kind))add('SDN_IDENTITY_ROLE',key,'Select an identity with the role required by this SDN control.')}
  if(s(d,'restName')&&(!dnsOrIpv4(s(d,'restName'))||ipv4(s(d,'restName'))!==null))add('SDN_REST_NAME','restName','Record the controller REST DNS name separately from its IPv4 address.')
  if(s(d,'restIp')&&!inNetwork(s(d,'restIp'),s(d,'managementNetwork')))add('SDN_REST_ADDRESS','restIp','The REST address must belong to the selected management subnet.')
  const mgmt=project.design.networks.find(r=>r.id===d.managementNetwork)
  if(mgmt&&mgmt.values.purpose!=='management')add('SDN_NETWORK_PURPOSE','managementNetwork','Select a management-purpose network for controller management.')
  if(needProvider)required(d,['providerNetwork'],'Selected capabilities require an explicit HNV provider network.')
  const provider=project.design.networks.find(r=>r.id===d.providerNetwork)
  if(provider&&provider.values.purpose!=='provider')add('SDN_NETWORK_PURPOSE','providerNetwork','Select a provider-purpose HNV network.')
  if(needMux&&!d.publicVipNetwork&&!d.privateVipNetwork)add('SDN_VIP_NETWORK','publicVipNetwork','Load balancing or NAT requires an explicit VIP network.')
  for(const key of ['publicVipNetwork','privateVipNetwork']){const n=project.design.networks.find(r=>r.id===d[key]);if(n&&n.values.purpose!=='vip')add('SDN_NETWORK_PURPOSE',key,'Select a VIP-purpose network.')}
  const mac=(value:string)=>/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value)?parseInt(value.replace(/[:-]/g,''),16):null
  const start=mac(s(d,'macPoolStart')),end=mac(s(d,'macPoolEnd'))
  if((d.macPoolStart||d.macPoolEnd)&&(start===null||end===null||start>end||start===0||Math.floor(start/2**40)%2!==0||Math.floor(end/2**40)%2!==0||Math.floor(start/2**40)!==Math.floor(end/2**40)))add('SDN_MAC_POOL','macPoolStart','Use an ordered, nonzero unicast MAC pool within one first-octet block.')
  if(['existing','expand'].includes(project.sdn.scope))required(d,['fabricId','baseline'],'Existing and expanded fabrics require native identity and a preservation baseline.')
  if(['new','expand'].includes(project.sdn.scope))required(d,['changeScope'],'Describe the exact objects and host changes in the handoff.')
  if(project.sdn.scope==='new'&&project.sdn.owner==='existing')add('SDN_OWNER','intent','A new fabric requires an explicit deployment owner.')
  if(project.sdn.owner==='vmm'){
   if(!hostController&&project.components.find(c=>c.id===d.vmmComponent)?.product!=='vmm')add('SDN_VMM','vmmComponent','Select the active VMM service that owns this fabric.')
   if(hostController)add('SDN_VMM_FCNC_REVIEW','compatibilityEvidence','VMM service-template documentation does not qualify host-resident NC. Exact architecture/tool compatibility requires separate qualification.',undefined,'warning')
   else required(d,['vmmServiceTemplateId','vmmLogicalNetworkId','vmmLogicalSwitchId'],'The VMM controller path requires exact service-template and fabric object identities.')
  }
  const cluster=project.design.clusters.find(c=>c.id===d.controllerCluster),members=project.design.hosts.filter(h=>h.values.cluster===d.controllerCluster)
  if(hostController&&cluster?.values.topology==='standalone')add('SDN_CONTROLLER_CLUSTER','controllerCluster','Select an actual controller hosting cluster, not a standalone host group.')
  if(hostController){
   for(const host of members){const release=s(host.values,'currentOsBuild').match(/Windows Server\s+(20\d{2})\b/i)?.[1];if(release&&release!=='2025')add('SDN_OBSERVED_OS','controllerRelease','Host '+(host.values.name||host.id)+' reports Windows Server '+release+'; review upgrade and fresh inventory before FCNC deployment.',undefined,'warning')}
   if(!cluster||members.length<2)add('SDN_FCNC_NODES','controllerCluster','Host-resident NC requires at least two inventoried nodes in the selected failover cluster.')
   required(d,['sharedVolume','databasePath','binaryPath'],'Record FCNC shared storage and database/binary paths.')
   const volume=project.design.volumes.find(r=>r.id===d.sharedVolume)
   const system=project.design.storageSystems.find(r=>r.id===volume?.values.system)
   if(volume&&(!system||system.values.cluster!==d.controllerCluster||system.values.kind==='local'))add('SDN_FCNC_STORAGE','sharedVolume','The FCNC database volume must use a shared backend assigned to the controller cluster.')
   for(const h of members){if(resources.filter(r=>r.values.role==='hostcontroller'&&r.values.host===h.id).length!==1)add('SDN_HOST_OVERHEAD','controllerCluster',`Record exactly one controller overhead allowance for host ${h.values.name||h.id}.`);if(!bindings.some(b=>b.values.host===h.id))add('SDN_FCNC_HOST_BINDING','controllerCluster',`Bind controller host ${h.values.name||h.id} to its SDN switch and prerequisites.`)}
  }
  if(resources.some(r=>r.values.role===(hostController?'controller':'hostcontroller')))add('SDN_ARCHITECTURE','controllerCluster','Controller VM and host-resident controller resource models must match the selected architecture.')
  for(const role of requiredRoles)if(!resources.some(r=>r.values.role===role))add('SDN_ROLE_REQUIRED','intent',`Selected capabilities require a ${role} resource with placement and capacity.`)
  if(resources.some(r=>r.values.role!=='hostcontroller'))required(d,['image','vmLocation'],'SDN VM roles require a prepared image artifact and VM storage location.')
  if(!bindings.length)add('SDN_HOST_SCOPE','controllerCluster','Inventory the hosts participating in the SDN fabric.')
  for(const key of sdnCollectionKeys)for(const row of project.design[key]){
   required(row.values,['name','owner'],'Record an object name and responsible owner.',row)
   for(const f of collections.find(c=>c.key===key)!.fields)if(visibleField(f,row.values)&&f.collection&&row.values[f.key]&&!referenceOptions(project,f.collection).some(r=>r.id===row.values[f.key]))add('SDN_REFERENCE',f.key,`${f.label} references a removed or inactive resource.`,row)
  }
  const nativeIds=new Map<string,DesignRecord>()
  for(const row of [...resources,...peers,...services]){
   const v=row.values
   required(v,['lifecycle','lifecycleOwner'],'Select the object lifecycle and its single native configuration owner.',row)
   if(['preserve','adopt','configure','expand','replace'].includes(s(v,'lifecycle')))required(v,['nativeId','baseline'],'An existing object requires native identity and preservation evidence.',row)
   if(v.lifecycle==='create'&&s(v,'nativeId'))add('SDN_CREATE_IDENTITY','nativeId','A new object must not reuse an existing native object identity.',row)
   if(changed(v)&&v.lifecycleOwner!==project.sdn.owner)add('SDN_OWNER_CONFLICT','lifecycleOwner','Changed objects must have the fabric setup owner; resolve ownership before preparing changes.',row)
   if(project.sdn.scope==='existing'&&changed(v))add('SDN_EXISTING_CHANGE','lifecycle','Use-existing scope preserves objects. Select expand and describe the changes before requesting mutation.',row)
   if(v.lifecycle==='replace')add('SDN_REPLACEMENT','lifecycle','Replacement is outside the qualified SDN contract; preserve the object and record a separately reviewed replacement plan.',row)
   const id=s(v,'nativeId').toLowerCase();if(id){if(nativeIds.has(id))add('SDN_DUPLICATE_NATIVE_ID','nativeId','This native SDN object appears in multiple records; retain one lifecycle owner and definition.',row);nativeIds.set(id,row)}
  }
  for(const row of resources){
   const v=row.values,host=project.design.hosts.find(h=>h.id===v.host)
   required(v,['host','cluster','failureDomain','managementNetwork','prerequisites'],'Record exact role placement, failure domain, management network and prerequisites.',row)
   if(host&&host.values.cluster!==v.cluster)add('SDN_PLACEMENT','host','The selected host is outside this SDN resource hosting cluster.',row)
   if(v.role==='hostcontroller'&&v.cluster!==d.controllerCluster)add('SDN_CONTROLLER_PLACEMENT','cluster','Host-controller overhead belongs to the selected controller cluster.',row)
   for(const key of ['vCpu','memoryGiB','diskGiB'])if(Number(v[key])<=0)add('SDN_CAPACITY',key,'Record positive role capacity; unknown/default zero is not a sizing result.',row)
   if(s(v,'managementIp')&&!inNetwork(s(v,'managementIp'),s(v,'managementNetwork')))add('SDN_RESOURCE_ADDRESS','managementIp','The resource management address must belong to its selected management subnet.',row)
   if(v.role!=='hostcontroller'&&!s(v,'managementIp'))add('SDN_RESOURCE_ADDRESS','managementIp','Record the SDN VM management address.',row)
   if(s(v,'managementIp')===s(d,'restIp')&&v.managementNetwork===d.managementNetwork&&!(project.sdn.architecture==='controller-vms'&&d.controllerVmMode==='single'&&v.role==='controller'))add('SDN_REST_COLLISION','managementIp','The resource address collides with the controller REST address.',row)
  }
  for(const row of bindings){
   const v=row.values,sw=project.design.hostSwitches.find(sw=>sw.id===v.hostSwitch)
   required(v,['host','hostSwitch','lifecycleOwner','preservation','readiness','connectivity'],'Complete the participating host, ownership and readiness contract.',row)
   if(sw&&sw.values.host!==v.host)add('SDN_HOST_SWITCH','hostSwitch','The selected SDN switch belongs to another host.',row)
   if(bindings.some(b=>b.id!==row.id&&b.values.host===v.host))add('SDN_HOST_DUPLICATE','host','Retain one SDN participation and configuration owner per host.',row)
   if(v.lifecycleOwner!==project.sdn.owner&&project.sdn.scope!=='existing')add('SDN_HOST_OWNER','lifecycleOwner','The host SDN configuration owner conflicts with the fabric setup owner.',row)
   if(needProvider&&!v.providerNetwork)add('SDN_HOST_PROVIDER','providerNetwork','Map this host to its HNV provider network.',row)
  }
  for(const row of peers){const r=resources.find(r=>r.id===row.values.resource);if(!r||!['mux','gateway'].includes(s(r.values,'role')))add('SDN_BGP_RESOURCE','resource','Bind the local BGP peer to an inventoried MUX or gateway.',row);required(row.values,['network','routeAcceptance'],'Record the BGP transport and expected route/filter/withdrawal acceptance.',row)}
  for(const row of services){
   const v=row.values;required(v,['network','validation'],'Bind the tenant service network and acceptance criteria.',row)
   if(v.service==='gateway'&&resources.find(r=>r.id===v.gatewayResource)?.values.role!=='gateway')add('SDN_SERVICE_GATEWAY','gatewayResource','Bind this tenant gateway service to a gateway resource.',row)
   if(['loadBalancer','nat'].includes(s(v,'service'))&&!project.design.sdnFrontends.some(f=>f.values.service===row.id)){required(v,['vipNetwork','vip'],'Record the tenant service VIP and its network, then map structured frontends.',row);if(s(v,'vip')&&!inNetwork(s(v,'vip'),s(v,'vipNetwork')))add('SDN_SERVICE_VIP','vip','The service VIP must belong to its selected VIP subnet.',row)}
  }
 }
 const architecturePlan=sdnArchitecture(project);findings.push(...architecturePlan.findings)
 const servicePlan=sdnServices(project);findings.push(...servicePlan.findings)
 const serviceTargets=(...keys:string[])=>keys.flatMap(key=>(servicePlan.objects[key]??[]).map(r=>r.id))
 const capacity=(rows:DesignRecord[])=>rows.reduce((sum,r)=>({records:sum.records+1,vCpu:sum.vCpu+Number(r.values.vCpu||0),memoryGiB:sum.memoryGiB+Number(r.values.memoryGiB||0),diskGiB:sum.diskGiB+Number(r.values.diskGiB||0)}),{records:0,vCpu:0,memoryGiB:0,diskGiB:0})
 const specs:[string,string,string,string[]][]=[
  ['prerequisites','Physical, identity, media and preservation review','Confirm routing, VLAN/MTU, firewall, DNS/certificates, identities, images, baseline and exact approved scope.',[]],
  ['hosts','Host prerequisites','Confirm host roles, restart, AD membership, switch ownership and reachability.',bindings.map(r=>r.id)],
  ['controller','Controller setup or existing registration',hostController?'Review FCNC storage, host overhead and REST identity. Preserve or configure only named objects.':'Review controller VM template, placement and REST identity. Preserve or configure only named objects.',resources.filter(r=>['controller','hostcontroller'].includes(s(r.values,'role'))).map(r=>r.id)],
  ['networking','Host SDN networking','Apply only the selected owner’s host networking contract after controller readiness.',bindings.map(r=>r.id)],
  ['loadbalancer','SLB / MUX setup','Prepare selected MUX roles, SLB host agents and VIP policy; verify readiness before dependent gateways.',resources.filter(r=>r.values.role==='mux').map(r=>r.id)],
  ['gateways','Gateway setup','After required SLB readiness, prepare gateway roles, then pools and their membership; verify capacity and failure domains.',[...resources.filter(r=>r.values.role==='gateway').map(r=>r.id),...serviceTargets('sdnGatewayPools','sdnGatewayMembers')]],
  ['routing','BGP routing','Confirm exact peers, accepted/advertised prefixes, route filters and withdrawal behavior.',peers.map(r=>r.id)],
  ['tenant','Tenant services','Review tenant networks and service parents, then ACLs, frontends, backend pools and members, probes, traffic rules, gateway connections and routes in dependency order.',[...services.map(r=>r.id),...serviceTargets('sdnAclRules','sdnFrontends','sdnBackendPools','sdnBackendMembers','sdnProbes','sdnTrafficRules','sdnConnections','sdnRoutes')]],
  ['acceptance','Connectivity and failure acceptance','Return scoped results for required traffic and failure scenarios before claiming runtime acceptance.',[...[...resources,...services].map(r=>r.id),...serviceTargets(...Object.keys(servicePlan.objects))]],
 ]
 const stages=active?specs.filter(([key])=>key==='loadbalancer'?needMux||resources.some(r=>r.values.role==='mux'):key==='gateways'?needGateway||resources.some(r=>r.values.role==='gateway'):key==='routing'?peers.length>0:true).map(([id,name,instruction,targets],i,all)=>({id:`sdn-${id}`,order:i+1,name,instruction:project.sdn.scope==='existing'?`Review the existing ${name.toLowerCase()} and record scoped evidence; preserve current configuration.`:instruction,targets,dependsOn:i?[`sdn-${all[i-1][0]}`]:[],owner:project.sdn.owner,mode:project.sdn.scope==='existing'?'preserve-and-review':'scoped-handoff',status:'not-executed',executionAllowed:false})):[]
 const acceptance=active?[{id:'east-west',description:'Verify intended east/west paths and denied traffic between named endpoints.'},...(capabilities.isolation||capabilities.policy?[{id:'isolation',description:'Verify allowed same-tenant traffic and denied cross-tenant traffic, including overlapping isolated address spaces.'}]:[]),...(needGateway?[{id:'north-south',description:'Verify routed/tunneled connectivity, return paths and denied out-of-scope networks.'}]:[]),...(needMux?[{id:'vip-nat',description:'Verify configured VIP/NAT rules, backend probes and return paths.'}]:[]),...(peers.length?[{id:'bgp',description:'Verify exact accepted/advertised prefixes, filters, peer loss and route withdrawal.'}]:[]),{id:'failover',description:!hostController&&d.controllerVmMode==='single'?'Verify single-controller outage and recovery; no controller-service failover is available. Verify selected NFV recovery separately.':'Verify controller and selected NFV failover with recorded disruption and recovery objectives.'}]:[]
 return {kind:'hyperv-sdn-design',contractVersion:'1.0.0',projectId:project.id,revision:project.revision,active,scope:project.sdn.scope,architecture:project.sdn.architecture,owner:project.sdn.owner,intent:s(d,'intent'),intentLabel:sdnIntents[s(d,'intent') as keyof typeof sdnIntents]||'Not selected',capabilities,requiredRoles,capacity:{controllerHostOverhead:capacity(resources.filter(r=>r.values.role==='hostcontroller')),controllerVms:capacity(resources.filter(r=>r.values.role==='controller')),nfvVms:capacity(resources.filter(r=>['mux','gateway'].includes(s(r.values,'role'))))},controller:architecturePlan,inputs:active?{...project.sdn,details:activeSdnDetails(project.sdn)}:null,objects:active?Object.fromEntries(sdnCollectionKeys.map(key=>[key,servicePlan.objects[key]??sorted(project,key)])):{},stages,acceptance,services:servicePlan,findings,fabricContractComplete:active&&!findings.some(f=>f.severity==='error'),executionAllowed:false,runtimeQualified:false,sources:SDN_SOURCES}
}
