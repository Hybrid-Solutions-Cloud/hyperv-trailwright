import type {Project} from './project'
import type {Finding} from './validation'
import {activeSdnDetails} from './sdnActiveFields'

/** Source-reviewed design mapping. It never invokes vendor code or establishes runtime qualification. */
export function sdnArchitecture(project:Project){
 const d=activeSdnDetails(project.sdn),vm=project.sdn.architecture==='controller-vms',findings:Finding[]=[]
 const value=(key:string)=>String(d[key]??'').trim()
 const add=(code:string,fieldKey:string,message:string,severity:Finding['severity']='error')=>findings.push({code,fieldKey,message,severity,section:'sdn'})
 const required=(keys:string[])=>keys.forEach(key=>{if(!value(key))add('SDN_ARCHITECTURE_REQUIRED',key,'Complete the active controller architecture and deployment-tool decisions.')})
 const numericVersion=(v:string)=>/^\d+(?:\.\d+){0,3}$/.test(v)
 const atLeast=(v:string,min:string)=>{if(!numericVersion(v))return false;const a=v.split('.').map(Number),b=min.split('.').map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]??0)!==(b[i]??0))return (a[i]??0)>(b[i]??0)}return true}
 const controllers=project.design.sdnResources.filter(r=>r.values.role==='controller'),cluster=project.design.clusters.find(r=>r.id===d.controllerCluster)
 const expectedVmCount=vm?(d.controllerVmMode==='single'?1:d.controllerVmMode==='three'?3:d.controllerVmMode==='custom'?Number(d.controllerVmCount)||null:null):0
 if(project.sdn.scope!=='none'){
  required(['controllerRelease','controllerBuild','deploymentTool','deploymentToolBuild'])
  for(const key of ['controllerBuild','deploymentToolBuild'])if(value(key)&&!numericVersion(value(key)))add('SDN_VERSION_FORMAT',key,'Use only the exact numeric version or build; retain explanatory text in OS/tool notes.')
  if(d.controllerRelease==='other')add('SDN_RELEASE_REVIEW','controllerRelease','This release needs a separate source and compatibility review.','warning')
  if(!vm&&(d.controllerRelease!=='ws2025'||cluster?.values.os!=='ws2025'))add('SDN_OS','controllerRelease','The reviewed Hyper-V FCNC design requires Windows Server 2025 on its controller hosts.')
  const tool=value('deploymentTool'),expectedOwner:Record<string,string>={vmm:'vmm',sdnexpress:'powershell',wac:'operator',manual:'operator',existing:'existing'}
  if(tool&&project.sdn.owner!==expectedOwner[tool])add('SDN_TOOL_OWNER','deploymentTool','Select the setup owner corresponding to this deployment tool.')
  if(tool==='existing'&&!['existing','expand'].includes(project.sdn.scope))add('SDN_TOOL_SCOPE','deploymentTool','Existing controller preservation requires an existing or expanded fabric scope.')
  if(tool==='wac'){
   if(vm)add('SDN_TOOL_ARCHITECTURE','deploymentTool','This reviewed Windows Admin Center path describes FCNC. Select the host cluster role or document another deployment procedure.')
   if(!atLeast(value('deploymentToolBuild'),'2410'))add('SDN_TOOL_VERSION','deploymentToolBuild','The reviewed FCNC path requires Windows Admin Center 2410 or later.')
   if(!atLeast(value('wacExtensionVersion'),'3.6.0'))add('SDN_TOOL_VERSION','wacExtensionVersion','The reviewed FCNC path requires SDN extension 3.6.0 or later.')
  }
  if(!vm&&tool==='sdnexpress'&&!atLeast(value('deploymentToolBuild'),'1.1.231'))add('SDN_TOOL_VERSION','deploymentToolBuild','FCNC requires SDN Express 1.1.231 or later; exact source inspection remains separate from runtime qualification.')
  if(vm){
   required(['controllerVmMode','controllerVmGeneration','controllerVmAvailability','managementSecurityGroup','clientSecurityGroup'])
   if(d.controllerVmMode!=='single'){
    required(['controllerRestMode'])
    const networks=new Set(controllers.map(r=>r.values.managementNetwork).filter(Boolean))
    if(networks.size>1&&d.controllerRestMode!=='dns'||networks.size===1&&d.controllerRestMode==='dns')add('SDN_REST_TOPOLOGY','controllerRestMode','Use a reserved REST IP for one management subnet, or a REST DNS name for controllers across multiple management subnets.')
   }
   if(!expectedVmCount||controllers.length!==expectedVmCount)add('SDN_CONTROLLER_COUNT','controllerVmMode','Inventory exactly the selected number of controller VMs.')
   if(d.controllerVmMode==='custom')add('SDN_CUSTOM_CONTROLLER_REVIEW','controllerVmCount','Custom topology does not map to the documented single-node or three-node VMM templates.','warning')
   if(d.controllerVmMode==='single')add('SDN_SINGLE_CONTROLLER','controllerVmMode','A single controller has no controller-service redundancy; document outage and recovery acceptance.','warning')
   if(d.controllerVmAvailability==='clustered'&&(!cluster||cluster.values.topology==='standalone'||project.design.hosts.filter(h=>h.values.cluster===cluster.id).length<2))add('SDN_VM_HA_CLUSTER','controllerVmAvailability','Highly available controller VMs require an inventoried failover cluster with at least two hosts.')
   if(controllers.some(r=>r.values.cluster!==d.controllerCluster))add('SDN_CONTROLLER_PLACEMENT','controllerCluster','All controller VMs must belong to the selected hosting cluster or host group.')
   if(d.controllerVmMode==='three'&&(new Set(controllers.map(r=>r.values.host)).size<3||new Set(controllers.map(r=>String(r.values.failureDomain).trim().toLowerCase())).size<3))add('SDN_CONTROLLER_FAILURE_DOMAINS','controllerVmMode','Place the three controller VMs on distinct hosts and failure domains for the declared redundancy.')
   if(d.controllerVmMode==='single'&&controllers.length===1&&(controllers[0].values.managementIp!==d.restIp||controllers[0].values.managementNetwork!==d.managementNetwork))add('SDN_SINGLE_ENDPOINT','restIp','For a single controller, use its management address and controller FQDN as the REST endpoint.')
   if(tool==='vmm'){
    required(['vmmHostGroupId','vmmTemplateSource','vmmTemplateHash','vmmLocalAdminRunAsId','vmmManagementRunAsId'])
    if(value('vmmTemplateHash')&&!/^[a-f0-9]{64}$/i.test(value('vmmTemplateHash')))add('SDN_TEMPLATE_HASH','vmmTemplateHash','Record the SHA256 of the actual imported and customized template.')
   }
  }
 }
 const templateName=vm&&['single','three'].includes(value('controllerVmMode'))&&['1','2'].includes(value('controllerVmGeneration'))?`Network Controller ${d.controllerVmMode==='single'?'Standalone':'Production'} Generation ${d.controllerVmGeneration} VM.xml`:null
 return {kind:'hyperv-sdn-controller-architecture',contractVersion:1,active:project.sdn.scope!=='none',architecture:project.sdn.architecture,tool:value('deploymentTool'),version:value('deploymentToolBuild'),release:value('controllerRelease'),build:value('controllerBuild'),expectedVmCount,vmHostingAvailability:vm?value('controllerVmAvailability'):null,templateName,
  mapping:project.sdn.scope==='none'?null:project.sdn.owner==='vmm'&&vm?{type:'vmm-service-template-review',serviceTemplateId:d.vmmServiceTemplateId,templateSource:d.vmmTemplateSource,templateSha256:d.vmmTemplateHash,hostGroupId:d.vmmHostGroupId,vmImageId:d.image,logicalSwitchId:d.vmmLogicalSwitchId,parameters:{Management:d.vmmLogicalNetworkId,LocalAdmin:d.vmmLocalAdminRunAsId,MgmtDomainAccount:d.vmmManagementRunAsId,MgmtSecurityGroup:d.managementSecurityGroup,ClientSecurityGroup:d.clientSecurityGroup,...(d.controllerVmMode==='single'?{}:{RestEndPoint:d.controllerRestMode==='dns'?d.restName:d.restIp})},identityReferences:{domain:d.domainIdentity,controller:d.controllerIdentity,certificate:d.certificateIdentity},runtimeSecrets:['MgmtDomainAccountPassword','ServerCertificatePassword'],review:'Resolve domain FQDN and account names from the identity records; validate group membership, SPN permissions and certificate resources against the pinned template. Resolve credentials only at runtime.'}:{type:'controller-procedure-review',tool:value('deploymentTool'),version:value('deploymentToolBuild'),...(d.deploymentTool==='wac'?{sdnExtensionVersion:d.wacExtensionVersion}:{}),controllerCluster:d.controllerCluster,...(!vm?{sharedVolume:d.sharedVolume,databasePath:d.databasePath,binaryPath:d.binaryPath}:{vmImageId:d.image,vmLocation:d.vmLocation}),review:'A source-reviewed handoff; no executable controller consumer is qualified.'},findings,executionAllowed:false,runtimeQualified:false}
}
