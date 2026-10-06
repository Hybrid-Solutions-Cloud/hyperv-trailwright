import type {Project} from './project'
import type {Finding} from './validation'
import type {Answers} from './catalog'
import {collections} from './catalog'
import {validTime} from './discoveryContract'
const norm=(v:unknown)=>String(v||'').trim().toLowerCase()
const wwpn=(v:unknown)=>norm(v).replace(/[:-]/g,'')
const ordered=<T extends {id:string}>(rows:T[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id))
export function storageReadiness(project:Project,now=Date.now()){
  const findings:Finding[]=[]
  const add=(code:string,id:string,key:string,message:string,severity:Finding['severity']='error')=>findings.push({code,recordId:id,fieldKey:key,section:'storage',message,severity})
  const require=(v:Answers,keys:string[],id:string)=>{const collection=collections.find(c=>project.design[c.key].some(r=>r.id===id));for(const key of keys)if(!String(v[key]||'').trim())add('STORAGE_READINESS_INPUT',id,key,`${v.name||'Storage resource'}: record ${collection?.fields.find(f=>f.key===key)?.label||key} before qualifying this storage path.`,'warning')}
  const observation=(v:Answers,id:string)=>{if(v.observedAt&&(!validTime(v.observedAt)||Date.parse(String(v.observedAt))>now))add('STORAGE_OBSERVATION_TIME',id,'observedAt','Storage observations require a valid, non-future UTC timestamp.')}
  const disks=ordered(project.design.disks).map(d=>{
    const v=d.values,host=project.design.hosts.find(h=>h.id===v.host),pools=project.design.storageSystems.filter(s=>s.values.kind==='s2d'&&s.values.cluster===host?.values.cluster),pooled=pools.length>0&&v.role!=='boot'
    observation(v,d.id)
    if(pooled){
      require(v,['bus','presentation','sharedAccess','multipath','nativeDiskIds','driverVersion','certification','observedAt','evidence'],d.id)
      if(['fc','iscsi','sharedSas','virtual'].includes(String(v.bus)))add('S2D_DEVICE_CONNECTION',d.id,'bus','Physical Windows Server S2D capacity/cache devices must be attached to one host; SAN, shared SAS and virtual disks do not qualify for this physical deployment path.')
      if(['raid','external'].includes(String(v.presentation)))add('S2D_DEVICE_PRESENTATION',d.id,'presentation','S2D data devices need direct attachment or qualified physical-device passthrough; an array or RAID virtual disk is incompatible.')
      if(v.sharedAccess==='yes'||v.multipath==='yes')add('S2D_DEVICE_SHARING',d.id,v.sharedAccess==='yes'?'sharedAccess':'multipath','S2D pool devices cannot use shared-host access or MPIO. Keep SAN LUNs in their separate storage backend.')
      if(['ssd','nvme'].includes(String(v.media))){if(v.powerLossProtection==='no')add('S2D_FLASH_PROTECTION',d.id,'powerLossProtection','S2D solid-state devices require power-loss protection.');else if(v.powerLossProtection!=='yes')add('S2D_FLASH_REVIEW',d.id,'powerLossProtection','Establish flash power-loss protection for the exact device model.','warning')}
      if(v.presentation==='passthrough'&&v.bus&&v.bus!=='sas')add('S2D_PASSTHROUGH_REVIEW',d.id,'presentation','Review the exact controller and bus combination against the supported physical-device presentation; do not infer generic RAID passthrough support.','warning')
    }
    const incompatible=findings.some(f=>f.recordId===d.id&&['S2D_DEVICE_CONNECTION','S2D_DEVICE_PRESENTATION','S2D_DEVICE_SHARING','S2D_FLASH_PROTECTION'].includes(f.code))
    const reviewed=pooled&&['nvme','sata','sas'].includes(String(v.bus))&&['direct','passthrough'].includes(String(v.presentation))&&v.sharedAccess==='no'&&v.multipath==='no'&&!!v.certification&&!!v.evidence&&!!v.observedAt&&!findings.some(f=>f.recordId===d.id)
    return {id:d.id,hostId:String(v.host),poolIds:pools.map(s=>s.id).sort(),inputs:{...v},status:incompatible?'incompatible':!pooled?'not-pool-device':reviewed?'operator-reviewed':'review-required',runtimeQualified:false}
  })
  const interfaces=ordered(project.design.storageInterfaces).map(r=>{
    const v=r.values;require(v,['host','protocol','nativeId','initiator','port','fabric','driver','qualification','observedAt','evidence'],r.id);observation(v,r.id)
    if(v.protocol==='fc'&&v.initiator&&(!/^[a-f0-9]{16}$/.test(wwpn(v.initiator))||/^0{16}$/.test(wwpn(v.initiator))))add('SAN_WWPN',r.id,'initiator','A Fibre Channel initiator WWPN must contain eight hexadecimal octets and cannot be zero.')
    if(v.protocol==='fc'&&wwpn(v.initiator)&&project.design.storageInterfaces.some(other=>other.id!==r.id&&other.values.protocol==='fc'&&wwpn(other.values.initiator)===wwpn(v.initiator)))add('SAN_WWPN_DUPLICATE',r.id,'initiator','This Fibre Channel WWPN is already represented by another physical interface.')
    if(v.protocol==='iscsi'){
      require(v,['adapter','network'],r.id)
      const adapter=project.design.adapters.find(a=>a.id===v.adapter),network=project.design.networks.find(n=>n.id===v.network)
      if(v.adapter&&(!adapter||adapter.values.host!==v.host))add('SAN_INTERFACE_ADAPTER',r.id,'adapter','Select an Ethernet adapter belonging to this storage interface host.')
      if(v.network&&(!network||network.values.purpose!=='storage'))add('SAN_INTERFACE_NETWORK',r.id,'network','Select the reviewed storage transport network for this iSCSI interface.')
      if(v.initiator&&/\s/.test(String(v.initiator)))add('SAN_ISCSI_NAME',r.id,'initiator','An iSCSI initiator name cannot contain whitespace; record the exact native name.')
    }
    if(v.nativeId&&project.design.storageInterfaces.some(other=>other.id!==r.id&&other.values.host===v.host&&norm(other.values.nativeId)===norm(v.nativeId)))add('SAN_INTERFACE_DUPLICATE',r.id,'nativeId','This host storage port is already represented by another interface record.')
    return {id:r.id,inputs:{...v},runtimeQualified:false}
  })
  const routes=ordered(project.design.sanPaths).map(r=>{
    const v=r.values,volume=project.design.volumes.find(x=>x.id===v.volume),system=project.design.storageSystems.find(x=>x.id===volume?.values.system),port=project.design.storageInterfaces.find(x=>x.id===v.interface)
    require(v,['interface','pathAcceptance'],r.id);observation(v,r.id)
    if(v.interface){
      if(!port||port.values.host!==v.host||port.values.protocol!==system?.values.kind)add('SAN_ROUTE_INTERFACE',r.id,'interface','The initiator interface must belong to this host and match the SAN backend protocol.')
      if(port){const same=port.values.protocol==='fc'?wwpn(v.initiator)===wwpn(port.values.initiator):norm(v.initiator)===norm(port.values.initiator);if(!same)add('SAN_ROUTE_INITIATOR',r.id,'initiator','The route initiator differs from the selected physical storage interface.')}
    }
    if(system?.values.kind==='fc'&&v.target&&(!/^[a-f0-9]{16}$/.test(wwpn(v.target))||/^0{16}$/.test(wwpn(v.target))))add('SAN_TARGET_WWPN',r.id,'target','A Fibre Channel target WWPN must contain eight hexadecimal octets and cannot be zero.')
    if(system?.values.kind==='iscsi'){
      require(v,['network'],r.id)
      if(v.network&&port?.values.network&&v.network!==port.values.network)add('SAN_ROUTE_NETWORK',r.id,'network','The route and its initiating iSCSI interface must use the same reviewed transport network.')
    }
    return {id:r.id,inputs:{...v},runtimeQualified:false}
  })
  const systems=ordered(project.design.storageSystems).map(s=>{
    const v=s.values;require(v,['storageAction','storageOwner','accessAcceptance'],s.id)
    if(v.storageAction&&v.storageOwner&&(v.storageAction==='preserve')!==(v.storageOwner==='preserve'))add('STORAGE_BACKEND_OWNER',s.id,'storageOwner','Storage action and configuration owner disagree about preserving the backend.')
    if(v.storageAction&&v.storageAction!=='create')require(v,['nativeStorageId','baselineEvidence'],s.id)
    if(v.storageAction==='create'&&v.nativeStorageId)add('STORAGE_BACKEND_EXISTING',s.id,'nativeStorageId','Creating a new backend conflicts with its retained existing native identity.')
    if(v.storageAction==='replace')for(const key of ['replacementScope','storageChangeWindow'])if(!v[key])add('STORAGE_BACKEND_REPLACEMENT',s.id,key,'Backend replacement requires explicit data migration/approval scope and a change window.')
    const cacheMemory= v.kind==='s2d'?ordered(project.design.hosts.filter(h=>h.values.cluster===v.cluster)).map(h=>{
      const drives=project.design.disks.filter(d=>d.values.host===h.id),capacityBytes=drives.filter(d=>d.values.role==='capacity').reduce((n,d)=>n+Number(d.values.count)*Number(d.values.sizeGiB)*1024**3,0),cacheBytes=drives.filter(d=>d.values.role==='cache').reduce((n,d)=>n+Number(d.values.count)*Number(d.values.sizeGiB)*1024**3,0)
      const cacheTB=cacheBytes/1e12,metadataGB=cacheTB*4
      if(capacityBytes>400e12)add('S2D_NODE_CAPACITY_LIMIT',s.id,'rawTiB',`${v.name} / ${h.values.name}: capacity drives alone exceed the reviewed 400 TB per-server raw limit. TB here is decimal; inventory sizes are GiB.`)
      if(Number(h.values.memoryGiB)>0&&Number(h.values.memoryGiB)*1024**3<metadataGB*1e9)add('S2D_CACHE_MEMORY',h.id,'memoryGiB','Host memory is below the S2D cache metadata allowance alone. Reserve 4 GB per TB of cache in addition to OS, VM and application memory.')
      return {hostId:h.id,cacheTB,metadataGB,meaning:'Additional metadata allowance: decimal TB and GB; not total host memory demand.',runtimeQualified:false}
    }):[]
    if(v.kind==='s2d'&&Number(v.rawTiB)*1024**4>4000e12)add('S2D_POOL_CAPACITY_LIMIT',s.id,'rawTiB','The declared pool exceeds the reviewed 4,000 TB raw pool limit. TB here is decimal; the entered pool size is TiB.')
    if(['fc','iscsi'].includes(String(v.kind))){
      require(v,['mpioAcceptance'],s.id)
      for(const volume of ordered(project.design.volumes.filter(x=>x.values.system===s.id)))for(const host of ordered(project.design.hosts.filter(x=>x.values.cluster===v.cluster))){
        const hostRoutes=project.design.sanPaths.filter(x=>x.values.volume===volume.id&&x.values.host===host.id&&x.values.state!=='failed'),ports=hostRoutes.map(x=>project.design.storageInterfaces.find(p=>p.id===x.values.interface)).filter(p=>!!p).filter(p=>p.values.host===host.id&&p.values.protocol===v.kind)
        const physical=new Set(ports.map(p=>p.values.protocol==='fc'?wwpn(p.values.initiator):norm(p.values.nativeId)).filter(Boolean)),fabrics=new Set(ports.map(p=>norm(p.values.fabric)).filter(Boolean))
        if(hostRoutes.length>=2&&(physical.size<2||fabrics.size<2))add('SAN_PHYSICAL_DIVERSITY',volume.id,'hostMapping',`${volume.values.name} / ${host.values.name}: different route labels do not establish independent paths; correlate at least two distinct physical initiator ports and fabrics.`,'warning')
      }
    }
    return {id:s.id,inputs:{...v},cacheMemory,runtimeQualified:false}
  })
  const attachments=ordered(project.design.storageAllocations).map(a=>{
    const v=a.values,directory=project.design.storagePaths.find(d=>d.id===v.directory),volume=project.design.volumes.find(d=>d.id===directory?.values.volume),system=project.design.storageSystems.find(s=>s.id===volume?.values.system)
    require(v,['attachmentMode','accessEvidence'],a.id)
    if(v.attachmentMode==='host'){
      require(v,['accessHost'],a.id)
      const host=project.design.hosts.find(h=>h.id===v.accessHost)
      if(v.accessHost&&(!host||host.values.cluster!==system?.values.cluster))add('STORAGE_ATTACHMENT_HOST',a.id,'accessHost','This host does not belong to the selected storage backend cluster.')
      if(system?.values.kind==='local'&&v.accessHost&&system.values.localHost!==v.accessHost)add('STORAGE_LOCAL_ATTACHMENT',a.id,'accessHost','Node-local storage can only serve the physical host that owns it.')
    }
    if(v.attachmentMode==='cluster'){
      require(v,['accessCluster'],a.id)
      if(v.accessCluster&&v.accessCluster!==system?.values.cluster)add('STORAGE_ATTACHMENT_CLUSTER',a.id,'accessCluster','The resource attachment cluster differs from the storage backend cluster.')
    }
    if(system?.values.kind==='local'&&v.attachmentMode&&v.attachmentMode!=='host')add('STORAGE_LOCAL_ATTACHMENT',a.id,'attachmentMode','A node-local disk requires one explicit owning-host attachment; it cannot be treated as cluster-shared or provider storage.')
    return {id:a.id,resourceId:String(v.resource),systemId:system?.id||'',inputs:{...v},runtimeQualified:false}
  })
  return {kind:'hyperv-storage-readiness',version:'0.1.0',reviewedAt:'2026-09-11',sources:['https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements','https://learn.microsoft.com/en-us/windows-server/failover-clustering/storage-architectures'],projectId:project.id,revision:project.revision,disks,interfaces,routes,systems,attachments,findings,runtimeQualified:false}
}
export function storageMetadataSchedule(project:Project){return storageReadiness(project).systems.flatMap(s=>s.cacheMemory.map(m=>({StorageSystem:String(s.inputs.name),SystemId:s.id,Host:String(project.design.hosts.find(h=>h.id===m.hostId)?.values.name||m.hostId),HostId:m.hostId,CacheDecimalTB:m.cacheTB,AdditionalMetadataDecimalGB:m.metadataGB,Basis:m.meaning,RuntimeQualified:'No'})))}
