import type {Project} from './project'
import type {Finding} from './validation'
import {collections,type Answers} from './catalog'
import {validTime} from './discoveryContract'
import {cidr} from './networkAddress'

export const HOST_DEPLOYMENT_SOURCES=[
  'https://learn.microsoft.com/en-us/system-center/vmm/hyper-v-bare-metal?view=sc-vmm-2025',
  'https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements',
  'https://learn.microsoft.com/en-us/powershell/module/failoverclusters/new-cluster?view=windowsserver2025-ps',
  'https://learn.microsoft.com/en-us/powershell/module/failoverclusters/add-clusternode?view=windowsserver2025-ps',
  'https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/deploy/set-up-hosts-for-live-migration-without-failover-clustering',
]
const norm=(v:unknown)=>String(v||'').trim().toLowerCase()
const mac=(v:unknown)=>norm(v).replace(/[:-]/g,'')
export function hostDeploymentPlan(project:Project,now=Date.now()){
  const findings:Finding[]=[]
  const add=(code:string,message:string,id:string,key:string,severity:Finding['severity']='error')=>findings.push({code,message,recordId:id,fieldKey:key,severity,section:collections.find(c=>project.design[c.key].some(r=>r.id===id))?.section||'hardware'})
  const require=(v:Answers,keys:string[],id:string,collection:string)=>{for(const key of keys)if(!String(v[key]||'').trim())add('HOST_DEPLOYMENT_INPUT',String(v.name||'Resource')+': record '+(collections.find(c=>c.key===collection)?.fields.find(f=>f.key===key)?.label||key)+'.',id,key,'warning')}
  const clusters=project.design.clusters.map(c=>{
    const v=c.values,nodes=project.design.hosts.filter(h=>h.values.cluster===c.id)
    require(v,['lifecycle','intent','startingState','authority','topology','os','edition','build','securityBaseline','clusterStageBoundary'],c.id,'clusters')
    if(v.topology!=='standalone')require(v,['administrativeAccessPoint','admissionAcceptance'],c.id,'clusters')
    if(v.topology==='multisite')require(v,['siteRto','siteRpo','siteRecovery'],c.id,'clusters')
    if(['preserve','adopt','configure','expand','replace'].includes(String(v.lifecycle))&&v.topology!=='standalone')require(v,['existingClusterId','existingClusterEvidence'],c.id,'clusters')
    if(v.lifecycle==='create'&&v.existingClusterId)add('CLUSTER_EXISTING_ID','Creating a new cluster conflicts with a retained existing cluster identity.',c.id,'existingClusterId')
    if(v.lifecycle==='expand'&&!nodes.some(h=>h.values.clusterAction==='join'))add('CLUSTER_EXPANSION_MEMBERS','An expansion needs explicit new admissions as well as the existing membership baseline.',c.id,'existingClusterEvidence')
    if(v.administrativeAccessPoint==='adDns'){
      require(v,['directoryIdentity','computerOu'],c.id,'clusters')
      if(v.directoryIdentity&&project.design.identities.find(i=>i.id===v.directoryIdentity)?.values.kind!=='domain')add('CLUSTER_DIRECTORY','Select a domain/DNS identity prerequisite for this access point.',c.id,'directoryIdentity')
    }else if(['dns','none'].includes(String(v.administrativeAccessPoint)))add('CLUSTER_ACCESS_POINT_REVIEW','Qualify the selected access point against the intended clustered roles and management tools.',c.id,'administrativeAccessPoint','warning')
    if(v.migrationAuthentication||v.migrationTransport){
      require(v,['migrationAuthentication','migrationTransport','migrationConcurrency','migrationNetworks'],c.id,'clusters')
      if(!Number.isInteger(Number(v.migrationConcurrency)))add('MIGRATION_CONCURRENCY','Simultaneous migration count must be a whole number.',c.id,'migrationConcurrency')
      if(v.migrationAuthentication==='kerberos')require(v,['migrationDelegation'],c.id,'clusters')
      if(v.os==='ws2025'&&v.migrationAuthentication==='credssp')add('MIGRATION_CREDENTIAL_GUARD','The Windows Server 2025 baseline uses Credential Guard; review Kerberos constrained delegation instead of CredSSP-based live migration.',c.id,'migrationAuthentication',v.topology==='standalone'?'error':'warning')
    }
    const states=[...new Set(nodes.map(h=>String(h.values.currentState)).filter(s=>s&&s!=='unknown'))]
    if(v.startingState&&v.startingState!=='mixed'){
      const expected:Record<string,string>={baremetal:'baremetal',installed:'installed',ready:'ready',existing:'member'}
      if(states.some(s=>s!==expected[String(v.startingState)]))add('CLUSTER_MIXED_STATE','The cluster starting-state choice conflicts with its host inventory. Select mixed states or correct the individual observations.',c.id,'startingState')
    }
    return {clusterId:c.id,name:String(v.name),inputs:{...v},hostIds:nodes.map(h=>h.id),observedStates:states,runtimeQualified:false}
  })
  const hosts=project.design.hosts.map(h=>{
    const v=h.values,c=project.design.clusters.find(c=>c.id===v.cluster),profile=project.design.profiles.find(p=>p.id===v.profile)
    if(v.site&&c?.values.site&&c.values.topology==='cluster'&&v.site!==c.values.site)add('HOST_CLUSTER_SITE','A single-site cluster must use hosts in its recorded site. Correct the physical location or review a multi-site topology.',h.id,'site')
    for(const key of ['uuid','serial','fqdn'])if(norm(v[key])&&project.design.hosts.some(other=>other.id!==h.id&&norm(other.values[key])===norm(v[key])))add('HOST_IDENTITY_DUPLICATE','Physical inventory repeats this host identity. Resolve the duplicate before preparing deployment.',h.id,key)
    require(v,['currentState','inventoryObservedAt','inventoryEvidence','osAction','osOwner','hostRoleAction','hostRoleOwner','clusterAction','clusterJoinOwner','stageBoundary'],h.id,'hosts')
    if(v.currentState==='unknown')add('HOST_STATE_UNKNOWN','Establish the current host state before preparing a changing action.',h.id,'currentState','warning')
    if(v.inventoryObservedAt&&(!validTime(v.inventoryObservedAt)||Date.parse(String(v.inventoryObservedAt))>now))add('HOST_INVENTORY_TIME','Use a valid, non-future UTC host observation.',h.id,'inventoryObservedAt')
    if(['installed','ready','member'].includes(String(v.currentState)))require(v,['currentOsBuild'],h.id,'hosts')
    if(v.currentState==='member')require(v,['currentClusterId'],h.id,'hosts')
    const changed=!!((v.osAction&&v.osAction!=='preserve')||(v.hostRoleAction&&v.hostRoleAction!=='preserve')||['join','replace'].includes(String(v.clusterAction)))
    if(['preserve','adopt'].includes(String(v.lifecycle))&&changed)add('HOST_PRESERVE_ACTION','Preserve/adopt cannot request OS, Hyper-V role or cluster membership changes.',h.id,'lifecycle')
    if(v.osAction==='install'&&v.currentState&&v.currentState!=='baremetal')add('HOST_INSTALL_STATE','Initial installation requires confirmed bare metal; an installed machine needs explicit replacement scope.',h.id,'osAction')
    if(v.osAction==='preserve'&&v.currentState==='baremetal')add('HOST_NO_OS','There is no usable OS to preserve on this bare-metal host.',h.id,'osAction')
    if(v.osAction==='configure'&&v.currentState==='baremetal')add('HOST_NO_OS','Install an OS before requesting configuration of it.',h.id,'osAction')
    const replace=v.osAction==='reimage'||v.clusterAction==='replace'||v.lifecycle==='replace'
    if(replace){
      for(const key of ['previousMachineId','evacuationEvidence','reimageScope','changeWindow'])if(!String(v[key]||'').trim())add('HOST_REPLACEMENT_EVIDENCE','Replacement requires an exact prior identity, evacuation/data-preservation review, approved scope and change window.',h.id,key)
      if(v.lifecycle!=='replace')add('HOST_REPLACEMENT_LIFECYCLE','Select the explicit replacement lifecycle for this destructive or replacement action.',h.id,'lifecycle')
      if(v.osAction!=='reimage'&&v.clusterAction!=='replace')add('HOST_REPLACEMENT_ACTION','Identify whether replacement reimages the OS or replaces a cluster member.',h.id,'osAction')
    }
    if(v.hostRoleAction==='preserve'&&(v.currentState==='baremetal'||v.currentState==='installed'||v.osAction==='reimage'))add('HOST_ROLE_UNAVAILABLE','The selected OS state/action cannot preserve an existing Hyper-V role.',h.id,'hostRoleAction')
    if(v.hostRoleAction==='configure'&&(v.currentState==='baremetal'||v.currentState==='installed'||v.osAction==='reimage'))add('HOST_ROLE_UNAVAILABLE','The selected state/action has no existing Hyper-V role to configure. Select role installation and its owner.',h.id,'hostRoleAction')
    for(const [action,owner,preserve]of [['osAction','osOwner',['preserve']],['hostRoleAction','hostRoleOwner',['preserve']],['clusterAction','clusterJoinOwner',['preserve','none']]]as const){
      if(v[action]&&v[owner]&&((preserve as readonly string[]).includes(String(v[action])))!==(v[owner]==='preserve'))add('HOST_ACTION_OWNER','The action and its owner disagree about whether a change is selected.',h.id,owner)
    }
    if(['join','replace'].includes(String(v.clusterAction))&&c){
      if(['preserve','adopt'].includes(String(c.values.lifecycle)))add('HOST_CLUSTER_PRESERVE','Cluster admission changes membership; the target cluster cannot remain preserve/adopt.',h.id,'clusterAction')
      if(v.currentState==='member'&&v.currentClusterId&&c.values.existingClusterId&&norm(v.currentClusterId)!==norm(c.values.existingClusterId))add('HOST_FOREIGN_CLUSTER','This machine belongs to another cluster. Record and qualify a separate evacuation/removal workflow before admission.',h.id,'currentClusterId')
      if(v.clusterAction==='join'&&v.currentState==='member'&&norm(v.currentClusterId)&&norm(v.currentClusterId)===norm(c.values.existingClusterId))add('HOST_ALREADY_MEMBER','The machine is already a member of the target cluster; preserve its membership instead of joining it again.',h.id,'clusterAction')
      if(c.values.topology==='standalone')add('HOST_STANDALONE_JOIN','A standalone target cannot request cluster membership.',h.id,'clusterAction')
    }
    if(v.clusterAction==='preserve'&&v.currentState&&v.currentState!=='member')add('HOST_MEMBERSHIP_STATE','Only an observed cluster member can preserve cluster membership.',h.id,'clusterAction')
    if(changed){
      require(v,['site','rack','vendor','model','serial','uuid','cpuModel','sockets','coresPerSocket','memoryGiB','biosVersion','hardwareSupport','bootDiskIdentity'],h.id,'hosts')
      for(const key of ['slat','virtualizationEnabled','depEnabled']){
        if(v[key]==='no')add('HOST_HARDWARE_CAPABILITY','Hyper-V requires SLAT and enabled hardware virtualization/DEP; correct the hardware/firmware prerequisite.',h.id,key)
        else if(v[key]!=='yes')add('HOST_HARDWARE_REVIEW','Hardware capability is not established. Retain an observation or qualified platform review.',h.id,key,'warning')
      }
    }
    if(v.secureBoot&&(v.boot==='bios'||v.secureBootCapability==='no'))add('HOST_SECURE_BOOT','Secure Boot requires a capable UEFI platform.',h.id,'secureBoot')
    if(v.uuid&&(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(v.uuid))||/^0{8}(-0{4}){3}-0{12}$/.test(String(v.uuid))))add('HOST_UUID','SMBIOS UUID must be a non-zero GUID.',h.id,'uuid')
    for(const key of ['sockets','coresPerSocket'])if(v[key]&&!Number.isInteger(Number(v[key])))add('HOST_CPU_COUNT','Physical socket and core counts must be whole numbers.',h.id,key)
    if(v.bootDiskRecord){const disk=project.design.disks.find(d=>d.id===v.bootDiskRecord);if(!disk||disk.values.host!==h.id||disk.values.role!=='boot')add('HOST_BOOT_DISK','Select this host\'s boot disk inventory record.',h.id,'bootDiskRecord')}
    if(v.pxeAdapter){const adapter=project.design.adapters.find(a=>a.id===v.pxeAdapter);if(!adapter||adapter.values.host!==h.id||!mac(adapter.values.mac)||mac(adapter.values.mac)!==mac(v.pxeMac))add('HOST_PXE_ADAPTER','The PXE adapter must belong to this host and match its recorded PXE MAC.',h.id,'pxeAdapter')}
    if(profile?.values.method==='vmm'&&['install','reimage'].includes(String(v.osAction))){
      require(v,['bmcAddress','bmcProtocol','bmcPort','bmcFirmware','bmcCertificate','boot','pxeMac','pxeAdapter','bootOrder','dhcpReservation','bootDisk','partitionLayout','firmwareBaseline','acceptance'],h.id,'hosts')
      if(v.osOwner&&v.osOwner!=='vmm')add('HOST_VMM_OS_OWNER','A VMM bare-metal profile must have VMM ownership of OS provisioning.',h.id,'osOwner')
      if(v.hostRoleOwner&&v.hostRoleOwner!=='vmm')add('HOST_VMM_ROLE_OWNER','VMM bare-metal provisioning installs the Hyper-V role; record VMM as its owner.',h.id,'hostRoleOwner')
      if((v.boot==='uefi'&&profile.values.partitionStyle==='mbr')||(v.boot==='bios'&&profile.values.partitionStyle==='gpt'))add('HOST_PROFILE_BOOT','The physical firmware boot mode conflicts with the provisioning profile partition style.',h.id,'profile')
      if(v.boot&&profile.values.profileFirmware&&v.boot!==profile.values.profileFirmware)add('HOST_PROFILE_FIRMWARE','BIOS and UEFI machines require matching, separately reviewed physical profiles.',h.id,'profile')
      if(c?.values.os&&profile.values.os&&c.values.os!==profile.values.os)add('HOST_PROFILE_OS','The selected image profile OS conflicts with the target host/cluster release.',h.id,'profile')
      if(profile.values.profileDomain&&v.fqdn&&norm(v.fqdn).split('.').slice(1).join('.')!==norm(profile.values.profileDomain))add('HOST_VMM_NAMESPACE','The VMM bare-metal host DNS suffix differs from the profile AD domain. Qualify a separate namespace transition; do not infer ordinary bare-metal support.',h.id,'profile')
      if(!v.bmcCredentialRef&&!v.bmcRunAsId)add('HOST_BMC_IDENTITY','Record the scoped BMC Run As object or runtime credential reference.',h.id,'bmcCredentialRef','warning')
      for(const key of ['wdsServer','wdsRegistration','adkVersion','winpeVersion','image','hardwareApplicability','libraryPath','storagePrerequisites','preflight','completion'])if(!String(profile.values[key]||'').trim())add('HOST_VMM_PROFILE_INPUT','The selected VMM profile needs '+key+' for the per-host handoff.',profile.id,key,'warning')
      if(profile.values.image){const image=project.design.media.find(m=>m.id===profile.values.image);if(!image||!['vhd','vhdx'].includes(String(image.values.kind)))add('HOST_VMM_IMAGE','A VMM bare-metal profile needs a generalized VHD/VHDX artifact.',profile.id,'image')}
    }
    return {hostId:h.id,name:String(v.name),clusterId:String(v.cluster),profileId:String(v.profile),inputs:{...v},changing:changed,replacement:replace,runtimeQualified:false}
  })
  const profiles=project.design.profiles.filter(p=>p.values.method==='vmm').map(p=>{
    const v=p.values,assigned=project.design.hosts.filter(h=>h.values.profile===p.id)
    require(v,['profileFirmware','profileEvidence','pxeService','pxeNetwork','pxeReadiness','imageReadiness','namespaceReview'],p.id,'profiles')
    if(v.profileState==='existing'){require(v,['profileObservedAt'],p.id,'profiles');if(v.profileObservedAt&&(!validTime(v.profileObservedAt)||Date.parse(String(v.profileObservedAt))>now))add('PROFILE_OBSERVATION_TIME','Use a valid, non-future UTC profile observation.',p.id,'profileObservedAt')}
    if(v.pxeService&&project.components.find(c=>c.id===v.pxeService)?.product!=='pxe')add('PROFILE_PXE_SERVICE','Select an active PXE/WDS service component.',p.id,'pxeService')
    const network=project.design.networks.find(n=>n.id===v.pxeNetwork),range=network&&cidr(String(network.values.cidr))
    if(v.pxeNetwork&&!network)add('PROFILE_PXE_NETWORK','The deployment PXE network record is missing.',p.id,'pxeNetwork')
    for(const host of assigned){const adapter=project.design.adapters.find(a=>a.id===host.values.pxeAdapter),hostNetwork=project.design.networks.find(n=>n.id===adapter?.values.network),hostRange=hostNetwork&&cidr(String(hostNetwork.values.cidr));if(range&&hostRange&&(range.first!==hostRange.first||range.prefix!==hostRange.prefix||(network?.values.routingScope&&hostNetwork?.values.routingScope&&network.values.routingScope!==hostNetwork.values.routingScope)))add('PROFILE_PXE_SUBNET','The deployment PXE service and physical PXE adapter must use the reviewed same-subnet path.',host.id,'pxeAdapter')}
    return {profileId:p.id,name:String(v.name),inputs:{...v},hostIds:assigned.map(h=>h.id),runtimeQualified:false}
  })
  return {kind:'hyperv-host-deployment-plan',version:'0.1.0',projectId:project.id,revision:project.revision,meaning:'Current observations, desired actions and stage owners are separate. This is a design handoff; no host, cluster, disk or membership is changed.',hosts,clusters,profiles,findings,sources:HOST_DEPLOYMENT_SOURCES}
}
export function hostDeploymentSchedule(project:Project){return hostDeploymentPlan(project).hosts.map(h=>({Host:h.name,HostId:h.hostId,ClusterId:h.clusterId,ProfileId:h.profileId,ObservedState:String(h.inputs.currentState),ObservedOsBuild:String(h.inputs.currentOsBuild),ObservedClusterId:String(h.inputs.currentClusterId),OsAction:String(h.inputs.osAction),OsOwner:String(h.inputs.osOwner),HyperVRoleAction:String(h.inputs.hostRoleAction),HyperVRoleOwner:String(h.inputs.hostRoleOwner),ClusterAction:String(h.inputs.clusterAction),AdmissionOwner:String(h.inputs.clusterJoinOwner),Replacement:h.replacement,PreviousMachineId:String(h.inputs.previousMachineId),InventoryObservedAt:String(h.inputs.inventoryObservedAt),InventoryEvidence:String(h.inputs.inventoryEvidence),RuntimeQualified:'No'}))}
