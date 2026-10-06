import type {Project} from './project'
import {collections,visibleField,type DesignRecord} from './catalog'
import type {Finding} from './validation'
import {cidr,ipv4} from './networkAddress'
import {sdnServiceKeys} from './sdnServiceFields'
const s=(r:DesignRecord|undefined,k:string)=>String(r?.values[k]??'').trim()
const canonical=(value:string)=>{const n=cidr(value);return n&&ipv4(value.split('/')[0])===n.first?n:null}
const port=(value:unknown,min=1,max=65535)=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max
const ports=(value:string)=>{if(!/^\d{1,5}(?:-\d{1,5})?$/.test(value))return false;const [start,end=start]=value.split('-').map(Number);return start<=end&&end<=65535}
const prefix=(value:string)=>value==='*'||ipv4(value)!==null||!!canonical(value)
export const SDN_SERVICE_SOURCES=[
 'https://learn.microsoft.com/en-us/windows-server/networking/sdn/manage/configure-slb-and-nat',
 'https://learn.microsoft.com/en-us/powershell/module/networkcontroller/new-networkcontrolleraccesscontrollist?view=windowsserver2025-ps',
 'https://learn.microsoft.com/en-us/windows-server/networking/sdn/manage/add-a-virtual-gateway-to-a-tenant-virtual-network',
 'https://learn.microsoft.com/en-us/system-center/vmm/sdn-gateway?view=sc-vmm-2025',
]
export function sdnServices(project:Project){
 const active=project.sdn.scope!=='none',findings:Finding[]=[]
 const rows=(key:string)=>active?[...project.design[key]].sort((a,b)=>a.id.localeCompare(b.id)):[]
 const get=(key:string,id:string)=>rows(key).find(r=>r.id===id)
 const add=(code:string,row:DesignRecord,key:string,message:string,severity:Finding['severity']='error')=>findings.push({code,section:'sdn',recordId:row.id,fieldKey:key,message,severity})
 const require=(r:DesignRecord,keys:string[])=>{for(const key of keys)if(!s(r,key))add('SDN_SERVICE_REQUIRED',r,key,'Complete this structured service input before handoff.')}
 const services=rows('tenantServices'),frontends=rows('sdnFrontends'),pools=rows('sdnBackendPools'),members=rows('sdnBackendMembers'),probes=rows('sdnProbes'),rules=rows('sdnTrafficRules'),acls=rows('sdnAclRules'),gatewayPools=rows('sdnGatewayPools'),gatewayMembers=rows('sdnGatewayMembers'),connections=rows('sdnConnections'),routes=rows('sdnRoutes')
 const owner=(r:DesignRecord)=>get('tenantServices',s(r,'service'))
 const tenantNetwork=(service:DesignRecord|undefined,networkId:string)=>!!service&&!!s(service,'tenantId')&&services.some(r=>s(r,'tenantId')===s(service,'tenantId')&&s(r,'network')===networkId)&&get('networks',networkId)?.values.purpose==='tenant'
 const inNetwork=(address:string,id:string)=>{const net=get('networks',id),n=net&&cidr(s(net,'cidr')),ip=ipv4(address);return !!n&&ip!==null&&ip>=n.first&&ip<=n.last&&(n.prefix>=31||(ip>n.first&&ip<n.last))&&address!==s(net,'gateway')}
 const sameService=(row:DesignRecord,key:string,target:DesignRecord|undefined)=>{if(!target||s(target,'service')!==s(row,'service'))add('SDN_SERVICE_CROSS_OWNER',row,key,'Reference an object owned by this same tenant service; cross-service objects cannot be implicitly shared.')}
 const childRows=[...frontends,...pools,...probes,...rules,...acls,...connections]
 for(const key of sdnServiceKeys)for(const row of rows(key)){
  require(row,['name','owner'])
  for(const f of collections.find(c=>c.key===key)!.fields.filter(f=>visibleField(f,row.values)))if(f.collection&&s(row,f.key)&&!project.design[f.collection]?.some(r=>r.id===row.values[f.key]))add('SDN_SERVICE_REFERENCE',row,f.key,'This service reference is missing.')
 }
 for(const row of childRows){
  const parent=owner(row);if(!parent){add('SDN_SERVICE_PARENT',row,'service','Select the owning tenant service.');continue}
  if(['preserve','adopt','configure','expand','replace'].includes(s(parent,'lifecycle')))require(row,['nativeId','baseline'])
  if(parent.values.lifecycle==='create'&&s(row,'nativeId'))add('SDN_SERVICE_NEW_ID',row,'nativeId','A new service child must not claim an existing native identity.')
  if(s(row,'nativeId')&&childRows.some(other=>other.id!==row.id&&s(other,'service')===s(row,'service')&&s(other,'nativeId').toLowerCase()===s(row,'nativeId').toLowerCase()))add('SDN_SERVICE_NATIVE_DUPLICATE',row,'nativeId','Native child identities must be unique within the service.')
 }
 for(const service of services){
  const kind=s(service,'service'),children=childRows.filter(r=>s(r,'service')===service.id)
  if(!s(service,'tenantId'))add('SDN_TENANT_ID',service,'tenantId','Record the tenant identity used to scope subnets and service references.')
  if(!tenantNetwork(service,s(service,'network')))add('SDN_TENANT_NETWORK',service,'network','Map the service to a tenant-purpose subnet with its declared tenant identity.')
  if(services.some(other=>other.id!==service.id&&s(other,'network')===s(service,'network')&&s(other,'tenantId')!==s(service,'tenantId')))add('SDN_TENANT_SUBNET_REUSE',service,'network','A single tenant subnet record cannot belong to two tenant identities. Use separate isolated network records; tenant identifiers must match exactly.')
  const has=(key:string)=>rows(key).some(r=>s(r,'service')===service.id)
  if(kind==='policy'&&!has('sdnAclRules'))add('SDN_ACL_MISSING',service,'policy','Add structured security rules and their subnet/interface attachment.')
  if(['loadBalancer','nat'].includes(kind)&&!has('sdnTrafficRules'))add('SDN_TRAFFIC_MISSING',service,'ports','Add explicit load-balancing or NAT rules with frontend/backend bindings.')
  if(kind==='gateway'&&!has('sdnConnections'))add('SDN_CONNECTION_MISSING',service,'tunnel','Add typed IPsec, GRE or L3 connections and routing requirements.')
  if(children.length&&s(service,'vip')&&frontends.some(r=>s(r,'service')===service.id&&!frontends.some(f=>s(f,'service')===service.id&&s(f,'address')===s(service,'vip'))))add('SDN_LEGACY_VIP',service,'vip','The old VIP note disagrees with the structured frontend addresses; reconcile it explicitly.')
 }
 for(const row of frontends){
  require(row,['service','exposure','network','address','acceptance']);const v=row.values,parent=owner(row),net=get('networks',s(row,'network'))
  if(!['loadBalancer','nat'].includes(s(parent,'service')))add('SDN_FRONTEND_SERVICE',row,'service','A frontend belongs to a load-balancing or NAT tenant service.')
  if(v.exposure==='public'&&net?.values.purpose!=='vip'||v.exposure==='internal'&&!tenantNetwork(parent,s(row,'network')))add('SDN_FRONTEND_SCOPE',row,'network','Use a VIP-purpose network for public frontends or this tenant’s subnet for internal frontends.')
  if(!inNetwork(s(row,'address'),s(row,'network')))add('SDN_FRONTEND_ADDRESS',row,'address','Use a usable address in the selected frontend network, distinct from its gateway.')
 }
 for(const row of pools){require(row,['service','acceptance']);if(!['loadBalancer','nat'].includes(s(owner(row),'service')))add('SDN_POOL_SERVICE',row,'service','Backend pools belong to load-balancing or NAT services.');if(!members.some(m=>m.values.pool===row.id))add('SDN_BACKEND_EMPTY',row,'service','Add at least one exact network-interface/IP-configuration backend member.')}
 for(const row of members){
  require(row,['pool','network','interfaceId','address','preservation']);const pool=get('sdnBackendPools',s(row,'pool')),parent=pool&&owner(pool)
  if(!tenantNetwork(parent,s(row,'network')))add('SDN_BACKEND_TENANT',row,'network','The backend subnet must belong to the pool’s tenant.')
  if(!inNetwork(s(row,'address'),s(row,'network')))add('SDN_BACKEND_ADDRESS',row,'address','Record a usable backend address in its mapped tenant subnet.')
  if(members.some(m=>m.id!==row.id&&m.values.pool===row.values.pool&&(s(m,'interfaceId')===s(row,'interfaceId')||s(m,'address')===s(row,'address')&&m.values.network===row.values.network)))add('SDN_BACKEND_DUPLICATE',row,'interfaceId','A backend interface/address can appear only once in this pool.')
  if(members.some(m=>m.id!==row.id&&s(m,'interfaceId')===s(row,'interfaceId')&&s(owner(get('sdnBackendPools',s(m,'pool'))||{id:'',values:{}}),'tenantId')!==s(parent,'tenantId')))add('SDN_BACKEND_IDENTITY_SCOPE',row,'interfaceId','One native interface IP configuration cannot belong to different tenants.')
 }
 for(const row of probes){
  require(row,['service','protocol','sourceReachability','acceptance']);if(s(owner(row),'service')!=='loadBalancer')add('SDN_PROBE_SERVICE',row,'service','A health probe belongs to a load-balancing service.')
  for(const [key,max]of [['port',65535],['intervalSeconds',86400],['threshold',1000]] as const)if(!port(row.values[key],1,max))add('SDN_PROBE_RANGE',row,key,'Use a positive whole-number probe setting within its declared range.')
  if(row.values.protocol==='http'&&(!s(row,'path').startsWith('/')||/[\r\n]/.test(s(row,'path'))))add('SDN_PROBE_PATH',row,'path','HTTP probes need an absolute request path beginning with /.')
 }
 const listeners=new Set<string>()
 for(const row of rules){
  require(row,['service','kind','frontend','protocol','acceptance']);const v=row.values,kind=s(row,'kind'),parent=owner(row),frontend=get('sdnFrontends',s(row,'frontend'))
  sameService(row,'frontend',frontend)
  if((kind==='loadBalance'&&s(parent,'service')!=='loadBalancer')||(['inboundNat','outboundNat'].includes(kind)&&!['loadBalancer','nat'].includes(s(parent,'service'))))add('SDN_RULE_SERVICE',row,'service','This rule kind is incompatible with its owning service.')
  if(kind==='inboundNat'){const member=get('sdnBackendMembers',s(row,'member'));sameService(row,'member',member&&get('sdnBackendPools',s(member,'pool')))}
  else sameService(row,'pool',get('sdnBackendPools',s(row,'pool')))
  if(kind==='loadBalance'){sameService(row,'probe',get('sdnProbes',s(row,'probe')));require(row,['distribution','floatingIp'])}
  if(kind!=='outboundNat'){
   for(const key of ['frontendPort','backendPort','idleMinutes'])if(!port(v[key],1,key==='idleMinutes'?1440:65535))add('SDN_RULE_PORT',row,key,'Use a positive integer port or timeout within the declared range.')
   if(!['tcp','udp'].includes(s(row,'protocol')))add('SDN_RULE_PROTOCOL',row,'protocol','Inbound load-balancing and NAT rules require TCP or UDP.')
   const key=`${s(row,'frontend')}/${s(row,'protocol')}/${v.frontendPort}`;if(listeners.has(key))add('SDN_LISTENER_DUPLICATE',row,'frontendPort','This frontend/protocol/port is already assigned to a load-balancing or inbound NAT rule.');listeners.add(key)
  }else if(frontend?.values.exposure!=='public')add('SDN_OUTBOUND_FRONTEND',row,'frontend','Outbound NAT requires an explicit public VIP frontend.')
 }
 const priorities=new Set<string>()
 for(const row of acls){
  require(row,['service','attachment','network','direction','action','protocol','logging','acceptance']);const v=row.values,parent=owner(row)
  if(s(parent,'service')!=='policy')add('SDN_ACL_SERVICE',row,'service','Security rules belong to a security-policy service.')
  if(!tenantNetwork(parent,s(row,'network')))add('SDN_ACL_TENANT',row,'network','Attach policy only to a subnet in the owning tenant.')
  if(v.attachment==='interface')require(row,['interfaceId'])
  if(!port(v.priority))add('SDN_ACL_PRIORITY',row,'priority','Record a whole priority from 1–65535; exact consumer constraints still need qualification.')
  for(const key of ['sourcePrefix','destinationPrefix'])if(!prefix(s(row,key)))add('SDN_ACL_PREFIX',row,key,'Use *, strict IPv4, or a canonical IPv4 CIDR.')
  for(const key of ['sourcePorts','destinationPorts'])if(!ports(s(row,key)))add('SDN_ACL_PORTS',row,key,'Use one port or an ascending range from 0 through 65535.')
  if(['all','icmp'].includes(s(row,'protocol'))&&['sourcePorts','destinationPorts'].some(k=>s(row,k)!=='0-65535'))add('SDN_ACL_PROTOCOL_PORTS',row,'protocol','All/ICMP rules use the full port range; ports cannot narrow non-TCP/UDP traffic.')
  const key=`${s(row,'service')}/${s(row,'direction')}/${v.priority}`;if(priorities.has(key))add('SDN_ACL_PRIORITY_DUPLICATE',row,'priority','Priorities must be unique per policy and direction.');priorities.add(key)
 }
 const capacity=gatewayPools.map(pool=>{
  require(pool,['connectionType','lifecycle','lifecycleOwner','capacityEvidence','acceptance'])
  if(pool.values.lifecycle!=='create')require(pool,['nativeId','baseline'])
  if(pool.values.lifecycle==='create'&&s(pool,'nativeId'))add('SDN_GATEWAY_POOL_NEW_ID',pool,'nativeId','A new gateway pool must not reuse an existing native identity.')
  if(s(pool,'nativeId')&&gatewayPools.some(other=>other.id!==pool.id&&s(other,'nativeId').toLowerCase()===s(pool,'nativeId').toLowerCase()))add('SDN_GATEWAY_POOL_NATIVE_DUPLICATE',pool,'nativeId','Retain one gateway pool definition and configuration owner per native identity.')
  if(pool.values.lifecycle!=='preserve'&&pool.values.lifecycleOwner!==project.sdn.owner)add('SDN_GATEWAY_POOL_OWNER',pool,'lifecycleOwner','Changed gateway pools must use the fabric’s configuration owner.')
  if(project.sdn.scope==='existing'&&pool.values.lifecycle!=='preserve')add('SDN_GATEWAY_POOL_PRESERVE',pool,'lifecycle','Use-existing scope cannot change a gateway pool.')
  const linked=gatewayMembers.filter(m=>m.values.pool===pool.id),demands=connections.filter(c=>c.values.pool===pool.id),reserve=Number(pool.values.reserveMembers)
  if(!linked.length||!port(reserve,0,linked.length-1))add('SDN_GATEWAY_RESERVE',pool,'reserveMembers','Record members and a reserve count that leaves a running gateway.')
  const known=linked.length>0&&port(reserve,0,linked.length-1)&&linked.every(m=>port(m.values.capacityMbps,1,1e9)&&!!s(m,'capacityEvidence'))
  const sizes=linked.map(m=>Number(m.values.capacityMbps)).sort((a,b)=>b-a),available=known?sizes.slice(reserve).reduce((a,b)=>a+b,0):null
  const required=demands.every(c=>port(c.values.inboundMbps,1,1e9)&&port(c.values.outboundMbps,1,1e9))?demands.reduce((n,c)=>n+Math.max(Number(c.values.inboundMbps),Number(c.values.outboundMbps)),0):null
  if(required!==null&&available!==null&&required>available)add('SDN_GATEWAY_CAPACITY',pool,'reserveMembers','Requested tenant bandwidth exceeds remaining pool capacity after the largest reserved members are unavailable.')
  return {id:pool.id,name:s(pool,'name'),members:linked.length,reserve,availableMbps:available,requestedMbps:required,headroomMbps:available===null||required===null?null:available-required,basis:'Declared per-pool throughput allocation; sum of max(inbound,outbound), not a runtime performance result'}
 })
 for(const row of gatewayMembers){
  require(row,['pool','resource','capacityEvidence']);if(get('sdnResources',s(row,'resource'))?.values.role!=='gateway')add('SDN_GATEWAY_MEMBER_ROLE',row,'resource','Select an inventoried gateway VM.')
  if(!port(row.values.capacityMbps,1,1e9))add('SDN_GATEWAY_MEMBER_CAPACITY',row,'capacityMbps','Record a positive whole-number qualified throughput.')
  if(gatewayMembers.some(m=>m.id!==row.id&&m.values.resource===row.values.resource&&m.values.pool===row.values.pool))add('SDN_GATEWAY_MEMBER_REUSE',row,'resource','A gateway VM can be counted only once in this pool.')
  const shared=gatewayMembers.filter(m=>m.values.resource===row.values.resource),resource=get('sdnResources',s(row,'resource'))
  if(shared.length>1&&(!Number(resource?.values.throughputGbps)||shared.reduce((n,m)=>n+Number(m.values.capacityMbps),0)>Number(resource?.values.throughputGbps)*1000))add('SDN_GATEWAY_SHARED_BUDGET',row,'capacityMbps','Shared gateway per-pool allocations must fit its qualified total VM throughput; record that total on the gateway resource.')
 }
 for(const row of connections){
  require(row,['service','pool','kind','network','remoteAddress','routing','routePolicy','acceptance']);const v=row.values,parent=owner(row),pool=get('sdnGatewayPools',s(row,'pool'))
  if(s(parent,'service')!=='gateway')add('SDN_CONNECTION_SERVICE',row,'service','A connection belongs to a gateway service.')
  if(pool&&pool.values.connectionType!==v.kind)add('SDN_GATEWAY_POOL_TYPE',row,'pool','Connection and gateway pool types must match.')
  if(!tenantNetwork(parent,s(row,'network')))add('SDN_CONNECTION_TENANT',row,'network','The gateway subnet must belong to this tenant.')
  if(ipv4(s(row,'remoteAddress'))===null)add('SDN_CONNECTION_REMOTE',row,'remoteAddress','Use an explicit remote IPv4 address.')
  for(const key of ['inboundMbps','outboundMbps'])if(!port(v[key],1,1e9))add('SDN_CONNECTION_BANDWIDTH',row,key,'Record positive whole-number directional bandwidth.')
  if(v.kind==='ipsec')require(row,['authRef','ipsecPolicy'])
  if(v.kind==='gre'&&!port(v.greKey,0,4294967295))add('SDN_GRE_KEY',row,'greKey','Use a whole unsigned 32-bit GRE key.')
  if(v.kind==='l3'){
   require(row,['transportNetwork','localAddress','peerAddress']);for(const key of ['localAddress','peerAddress'])if(!inNetwork(s(row,key),s(row,'transportNetwork')))add('SDN_L3_TRANSPORT',row,key,'L3 local/peer addresses must be usable in the selected transport network.')
   if(v.localAddress===v.peerAddress)add('SDN_L3_PEER',row,'peerAddress','L3 peer and local addresses must differ.')
  }
  if(v.routing==='bgp'){require(row,['bgpPeerAddress']);for(const key of ['localAsn','peerAsn'])if(!port(v[key],1,4294967295))add('SDN_TENANT_ASN',row,key,'Use a nonzero unsigned 32-bit ASN.');if(ipv4(s(row,'bgpPeerAddress'))===null)add('SDN_TENANT_BGP_ADDRESS',row,'bgpPeerAddress','Use an explicit tenant BGP peer IPv4.')}
  if(v.routing==='static'&&!routes.some(r=>r.values.connection===row.id))add('SDN_STATIC_ROUTES',row,'routing','Add the exact static destinations for this connection.')
 }
 for(const row of routes){
  require(row,['connection','destination','acceptance']);if(!canonical(s(row,'destination')))add('SDN_ROUTE_PREFIX',row,'destination','Use a canonical IPv4 network CIDR, including /0 for an explicit default route.')
  if(!port(row.values.metric,0))add('SDN_ROUTE_METRIC',row,'metric','Use a nonnegative whole route metric.')
  if(routes.some(r=>r.id!==row.id&&r.values.connection===row.values.connection&&s(r,'destination')===s(row,'destination')))add('SDN_ROUTE_DUPLICATE',row,'destination','Retain one definition of a destination in each connection.')
 }
 const objects=active?Object.fromEntries(sdnServiceKeys.map(key=>[key,rows(key).map(r=>({id:r.id,values:Object.fromEntries(collections.find(c=>c.key===key)!.fields.filter(f=>visibleField(f,r.values)).map(f=>[f.key,r.values[f.key]]))}))])):{}
 return {kind:'hyperv-sdn-services',contractVersion:'1.0.0',projectId:project.id,active,objects,capacity,findings,executionAllowed:false,runtimeQualified:false,reviewedAt:'2026-09-11',sources:SDN_SERVICE_SOURCES}
}
