import type {Field} from './catalog'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const capabilities={yes:'Available / enabled',no:'Unavailable / disabled',unknown:'Not established'}
const owners={preserve:'Preserve / no change',vmm:'VMM',native:'Native PowerShell / operator',ansible:'Ansible consumer',provider:'Provider / hardware owner',external:'External team'}
export const hostDeploymentFields:Field[]=[
  ref('site','Physical host site','sites'),
  choice('currentState','Observed host starting state',{baremetal:'Bare metal / no usable OS',installed:'OS installed',ready:'Hyper-V ready / unclustered',member:'Existing cluster member',unknown:'Not established'}),
  text('currentOsBuild','Observed host OS release / build'),text('currentClusterId','Observed native cluster identity'),
  text('inventoryObservedAt','Host inventory observation (UTC)'),notes('inventoryEvidence','Physical identity, OS and workload inventory evidence'),
  choice('osAction','Selected host OS action',{preserve:'Preserve current OS',install:'Install on confirmed bare metal',configure:'Configure installed OS',reimage:'Explicit replacement / reimage'}),
  choice('osOwner','Host OS installation/configuration owner',owners),
  choice('hostRoleAction','Hyper-V host role action',{preserve:'Preserve existing role',enable:'Enable and configure Hyper-V',configure:'Configure existing Hyper-V role'}),
  choice('hostRoleOwner','Hyper-V host role owner',owners),
  choice('clusterAction','Host cluster membership action',{none:'Standalone / no membership change',preserve:'Preserve current membership',join:'Join target cluster',replace:'Replace an explicitly identified member'}),
  choice('clusterJoinOwner','Host cluster admission owner',owners),
  notes('stageBoundary','Per-host OS, role, network, storage and cluster stage boundary'),
  text('previousMachineId','Prior physical machine / replacement target identity'),notes('evacuationEvidence','Workload evacuation and data preservation acceptance'),
  text('cpuModel','CPU model and architecture'),choice('slat','Second-level address translation (SLAT)',capabilities),choice('virtualizationEnabled','Hardware virtualization firmware setting',capabilities),choice('depEnabled','Hardware-enforced DEP firmware setting',capabilities),
  text('biosVersion','BIOS / UEFI version and release'),choice('secureBootCapability','Firmware Secure Boot capability',capabilities),
  text('bootDiskIdentity','Native OS boot disk / controller identity'),ref('bootDiskRecord','OS boot disk inventory record','disks'),ref('pxeAdapter','Physical PXE adapter record','adapters'),
  notes('hardwareSupport','Exact hardware, firmware, driver and target OS support review'),
]
export const clusterDeploymentFields:Field[]=[
  text('existingClusterId','Existing native cluster identity'),notes('existingClusterEvidence','Existing membership, functional level and storage baseline'),
  choice('administrativeAccessPoint','Cluster administrative access point',{adDns:'Active Directory and DNS',dns:'DNS only',none:'No administrative access point'}),
  ref('directoryIdentity','Cluster directory / DNS prerequisite','identities'),text('computerOu','Cluster computer OU / pre-staged identity'),
  choice('migrationAuthentication','Live migration authentication',{kerberos:'Kerberos constrained delegation',credssp:'CredSSP',external:'Externally controlled / separate qualification'}),
  choice('migrationTransport','Live migration transport',{tcp:'TCP/IP',compression:'Compression',smb:'SMB'}),
  {key:'migrationConcurrency',label:'Maximum simultaneous live migrations',type:'number',min:0,max:1000},
  notes('migrationNetworks','Permitted live migration networks and isolation'),notes('migrationDelegation','Live migration constrained delegation and trust review'),
  notes('securityBaseline','Host/cluster security baseline, Credential Guard and privileged access'),
  notes('admissionAcceptance','New and existing node validation / admission acceptance'),notes('clusterStageBoundary','Cluster membership, quorum, storage and networking stage ownership'),
  text('siteRto','Cluster site recovery time objective'),text('siteRpo','Cluster site recovery point objective'),notes('siteRecovery','Multi-site support, failure boundaries, data consistency and failback acceptance'),
]
export const provisioningReadinessFields:Field[]=[
  choice('profileFirmware','Profile hardware firmware mode',{bios:'BIOS',uefi:'UEFI'}),
  text('profileObservedAt','Existing profile observation (UTC)'),notes('profileEvidence','Profile firmware, image and network readback / design review'),
  ref('pxeService','VMM deployment PXE service component','$components'),ref('pxeNetwork','Deployment PXE network','networks'),
  notes('pxeReadiness','WDS deployment/transport roles, VMM provider registration and subnet reachability'),
  notes('imageReadiness','Generalization, VHD boot support, exact image edition/build and servicing acceptance'),
  notes('namespaceReview','Host domain/DNS suffix, pre-staging and non-disjoint namespace review'),
]
