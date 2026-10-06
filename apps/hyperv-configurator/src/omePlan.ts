import type {Component,Project} from './project'
import type {Finding} from './validation'
import {omePlugins,omeMilestones} from './omeFields'
import {releaseLabel,SUPPORT_SOURCES} from './supportCatalog'
import {ipv4,cidr,dnsOrIpv4} from './networkAddress'
import {validTime} from './discoveryContract'

export const OME_CATALOG={version:'0.1.0',release:'4.7',reviewedAt:'2026-09-11',sources:[SUPPORT_SOURCES.ome,SUPPORT_SOURCES.omeHost],plugins:omePlugins,
  profiles:{small:{baseMemoryGB:19,allPluginsMemoryGB:40,cores:4,primaryGB:415,secondaryGB:415},large:{baseMemoryGB:40,allPluginsMemoryGB:64,cores:16,primaryGB:415,secondaryGB:415},extraLarge:{baseMemoryGB:256,allPluginsMemoryGB:256,cores:64,primaryGB:600,secondaryGB:415}},
  meaning:'Vendor GB is retained until the operator reviews its interpretation. Extra-large includes the primary-disk expansion for metrics; plug-ins are excluded. No automatic platform, capacity or entitlement approval.'}

/** Validate bounded expressions without enumerating a subnet or contacting a device. */
export function omeDiscoveryTargets(value:string){
  const entries=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  if(entries.length>1000)return {entries:[],addressCount:null,errors:['Use at most 1,000 discovery expressions.']}
  const intervals:{first:number;last:number}[]=[],names=new Set<string>(),errors:string[]=[]
  for(const entry of entries){
    const address=ipv4(entry),network=entry.includes('/')?cidr(entry):null
    const pair=entry.match(/^(\d+\.\d+\.\d+\.\d+)\s*-\s*(\d+\.\d+\.\d+\.\d+)$/)
    if(address!==null)intervals.push({first:address,last:address})
    else if(network)intervals.push({first:network.first,last:network.last})
    else if(pair){const first=ipv4(pair[1]),last=ipv4(pair[2]);if(first===null||last===null||first>last)errors.push('Invalid or reversed IPv4 range: '+entry);else intervals.push({first,last})}
    else if(!entry.includes('/')&&dnsOrIpv4(entry))names.add(entry.toLowerCase())
    else errors.push('Invalid discovery expression: '+entry)
  }
  intervals.sort((a,b)=>a.first-b.first)
  let count=0,end=-1
  for(const r of intervals){count+=Math.max(0,r.last-Math.max(end,r.first-1));end=Math.max(end,r.last)}
  // DNS names can resolve to an address already listed. Count expressions separately; never infer inventory size.
  return {entries,addressCount:errors.length?null:count,dnsNames:names.size,errors}
}
export function omeAppliancePlan(c:Component,now=Date.now()){
  const v=c.productDetails,findings:Finding[]=[],name=c.name||'OME'
  const add=(code:string,message:string,key:string,severity:Finding['severity']='error')=>findings.push({code,section:'products',recordId:c.id,fieldKey:key,severity,message:name+': '+message})
  const profile=String(v.sizingProfile||''),known=releaseLabel(c.version,'4.7')&&['small','large','extraLarge'].includes(profile)
  const plugins=omePlugins.map(p=>({...p,state:String(v['plugin_'+p.key]||''),selectedVersion:String(v['pluginVersion_'+p.key]||'')}))
  const enabled=plugins.filter(p=>p.state==='enabled'),unanswered=plugins.filter(p=>!p.state)
  if(!Number.isInteger(c.ome.devices)||c.ome.devices<1)add('OME_DEVICES','Enter a positive whole managed-device count.','sizingProfile')
  if(!profile)add('OME_SIZING_PROFILE','Choose a reviewed sizing profile.','sizingProfile')
  if(profile&&profile!=='manual'&&!known)add('OME_RELEASE','The built-in sizing profiles apply only to an explicit 4.7 release; choose independent sizing for other releases.','sizingProfile')
  if(!v.sizingEvidence)add('OME_SIZING_EVIDENCE','Record release-specific sizing and growth review.','sizingEvidence',profile==='manual'?'error':'warning')
  if(unanswered.length)add('OME_PLUGIN_SELECTION','Review every plug-in, including the default Services and AIOps plug-ins.','plugin_'+unanswered[0].key)
  for(const p of enabled){if(!p.selectedVersion)add('OME_PLUGIN_VERSION','Pin the '+p.label+' version.','pluginVersion_'+p.key);else if(known&&p.selectedVersion!==p.version)add('OME_PLUGIN_VERSION','The reviewed 4.7 catalog lists '+p.label+' '+p.version+'; review the selected version independently.','pluginVersion_'+p.key)}
  if(known&&((profile==='small'&&c.ome.devices>=1000)||(profile==='large'&&(c.ome.devices<1000||c.ome.devices>8000))||(profile==='extraLarge'&&c.ome.devices>25000)))add('OME_PROFILE_LIMIT','Device count is outside the selected profile.','sizingProfile')
  if(profile==='extraLarge'&&enabled.length)add('OME_XL_PLUGINS','Extra-large capacity excludes all plug-ins.','plugin_'+enabled[0].key)
  if(profile==='extraLarge'&&c.ome.devices<25000)add('OME_XL_REVIEW','Confirm the extra-large profile for this device count with the release-specific deployment guide.','sizingEvidence','warning')
  const base=known?OME_CATALOG.profiles[profile as keyof typeof OME_CATALOG.profiles]:null
  // The published all-plug-in totals exceed the sum of individual increments. Retain the higher explicit recommendation.
  const vendor=base&&unanswered.length===0&&!(profile==='extraLarge'&&enabled.length)?{cores:base.cores,memoryGB:enabled.length===omePlugins.length?base.allPluginsMemoryGB:base.baseMemoryGB+enabled.reduce((n,p)=>n+(profile==='small'?p.small:p.large),0),primaryGB:base.primaryGB,secondaryGB:base.secondaryGB}:null
  const factor=v.capacityUnits==='binary'?1:v.capacityUnits==='decimal'?1e9/2**30:null
  const required=vendor&&factor!==null?{vCpu:vendor.cores,memoryGiB:Math.ceil(vendor.memoryGB*factor),primaryDiskGiB:Math.ceil(vendor.primaryGB*factor),secondaryDiskGiB:Math.ceil(vendor.secondaryGB*factor)}:null
  if(known&&factor===null)add('OME_CAPACITY_UNITS','Review vendor GB interpretation before comparing GiB allocations.','capacityUnits')
  if(required){
    if(c.vCpu<required.vCpu||c.memoryGiB<required.memoryGiB)add('OME_COMPUTE','Entered compute is below the reviewed requirement: '+required.vCpu+' vCPU and '+required.memoryGiB+' GiB.','capacityUnits')
    if(Number(v.primaryDiskGiB)<required.primaryDiskGiB||Number(v.secondaryDiskGiB)<required.secondaryDiskGiB)add('OME_DISKS','Record both virtual disks at or above the reviewed minimum.','primaryDiskGiB')
  }
  if(!Number(v.primaryDiskGiB)||(!Number(v.secondaryDiskGiB)&&profile!=='manual'))add('OME_DISKS','Record primary and secondary disk sizes; external platform exceptions require independent review.','primaryDiskGiB')
  if(c.diskGiB!==Number(v.primaryDiskGiB)+Number(v.secondaryDiskGiB))add('OME_DISK_TOTAL','Component disk capacity must equal the two recorded virtual disks; reserve datastore overhead separately.','primaryDiskGiB')
  if(profile!=='extraLarge'&&Number(v.primaryDiskGiB)!==Number(v.secondaryDiskGiB))add('OME_DISK_PAIR','The generic appliance requires equal-capacity disks; document a release/platform exception using independent sizing.','secondaryDiskGiB',profile==='manual'?'warning':'error')
  const targets=omeDiscoveryTargets(String(v.idracTargets||''))
  if(!targets.entries.length)add('OME_DISCOVERY_TARGETS','Supply the explicit discovery addresses or bounded ranges for the operator.','idracTargets')
  for(const error of targets.errors)add('OME_DISCOVERY_TARGETS',error,'idracTargets')
  for(const [key,label] of Object.entries({discoveryCredentialRef:'discovery credential reference',discoveryProtocols:'discovery protocol and path review',deviceSupport:'device feature support review',firmwareBaseline:'catalog/baseline ownership',integrationEvidence:'integration evidence or explicit no-integration decision',entitlementEvidence:'device/plug-in entitlement review',storageHeadroom:'storage expansion allowance'}))if(!v[key])add('OME_OPERATION_INPUT','Record '+label+'.',key,'warning')
  const milestones=Object.entries(omeMilestones).map(([key,label])=>{
    const state=String(v['manual_'+key]||''),owner=String(v['manualOwner_'+key]||''),evidence=String(v['manualEvidence_'+key]||''),observedAt=String(v['manualAt_'+key]||'')
    if(!state||!owner)add('OME_CHECKLIST','Assign a state and owner for '+label+'.','manual_'+key,'warning')
    if(['reported','notApplicable'].includes(state)&&!evidence.trim())add('OME_CHECKLIST_EVIDENCE','Provide evidence or the reviewed exclusion reason for '+label+'.','manualEvidence_'+key)
    if(state==='reported'&&(!validTime(observedAt)||Date.parse(observedAt)>now))add('OME_CHECKLIST_TIME','Provide a valid, non-future UTC observation for '+label+'.','manualAt_'+key)
    return {key,label,state:state||'unanswered',owner,evidence,observedAt,verification:'operator-reported; not independently verified'}
  })
  return {componentId:c.id,name,lifecycle:c.lifecycle,hosting:c.hosting,installation:'manual',runtimeQualified:false,profile,vendor,required,allocated:{vCpu:c.vCpu,memoryGiB:c.memoryGiB,diskGiB:c.diskGiB,primaryDiskGiB:Number(v.primaryDiskGiB)||0,secondaryDiskGiB:Number(v.secondaryDiskGiB)||0},plugins,targets,milestones,findings}
}
export function omePlan(project:Project){return {kind:'hyperv-ome-manual-plan',version:'0.1.0',projectId:project.id,revision:project.revision,catalog:OME_CATALOG,meaning:'Planning and operator observations only. No appliance deployment, discovery, entitlement activation or runtime acceptance occurs here.',appliances:project.components.filter(c=>c.product==='ome').map(c=>omeAppliancePlan(c))}}
