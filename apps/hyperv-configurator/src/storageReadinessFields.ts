import type {Field,Collection} from './catalog'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const observed={yes:'Confirmed',no:'Not available / not enabled',unknown:'Not established'}
export const physicalStorageFields:Field[]=[
  choice('bus','Physical storage connection',{nvme:'Local NVMe',sata:'Local SATA',sas:'Local SAS',fc:'Fibre Channel SAN',iscsi:'iSCSI SAN',sharedSas:'Shared SAS enclosure',virtual:'Virtual disk',other:'Other / review'}),
  choice('presentation','Storage controller presentation',{direct:'Direct attached',passthrough:'HBA / qualified SAS passthrough',raid:'RAID virtual disk',external:'Array / external presentation',unknown:'Not established'}),
  choice('sharedAccess','Devices accessible from multiple hosts',observed),choice('multipath','Multiple paths to these devices',observed),choice('powerLossProtection','Flash power-loss protection',observed),
  text('nativeDiskIds','Native disk identities / serials'),text('driverVersion','Storage driver name and version'),text('enclosureId','Physical enclosure identity'),
  notes('certification','Exact OS, device, firmware and controller certification'),text('observedAt','Physical storage observation (UTC)'),notes('evidence','Physical storage eligibility observation'),
]
export const storageOwnershipFields:Field[]=[
  choice('storageAction','Storage backend action',{preserve:'Preserve / document existing backend',create:'Create a new backend',expand:'Expand existing backend',replace:'Explicit backend replacement'}),
  choice('storageOwner','Storage backend configuration owner',{preserve:'Preserve / no configuration',native:'Native PowerShell / operator',vmm:'VMM',vendor:'Storage vendor / provider',external:'External storage team'}),
  text('nativeStorageId','Existing native pool / array / service identity'),notes('baselineEvidence','Existing pool, device and volume baseline'),
  notes('replacementScope','Backend replacement scope, data migration and approval'),text('storageChangeWindow','Backend change window'),
  notes('mpioAcceptance','MPIO provider, load policy, path failure and recovery acceptance'),notes('accessAcceptance','Exact host/resource access and storage presentation acceptance'),
]
export const sanRouteFields:Field[]=[ref('interface','Initiating storage interface','storageInterfaces'),ref('network','iSCSI transport network','networks'),notes('pathAcceptance','Physical route and independent-path acceptance')]
export const storageAttachmentFields:Field[]=[choice('attachmentMode','Storage attachment scope',{host:'One physical host',cluster:'All intended cluster nodes',external:'External provider / separate access review'}),ref('accessHost','Storage access host','hosts'),ref('accessCluster','Storage access cluster','clusters'),notes('accessEvidence','Resource placement and storage access acceptance')]
export const storageInterfacesCollection:Collection={key:'storageInterfaces',title:'Host storage interfaces',singular:'storage interface',section:'storage',description:'One physical initiator port per record. Keep Fibre Channel HBAs separate from Ethernet adapter inventory.',fields:[
  {...text('name','Name'),required:true},{...text('owner','Owner'),required:true},{...ref('host','Initiating host','hosts'),required:true},
  {...choice('protocol','Storage interface protocol',{fc:'Fibre Channel',iscsi:'iSCSI'}),required:true},
  text('nativeId','Native HBA / interface identity'),text('initiator','Initiator WWPN / iSCSI name'),text('port','Physical slot / port'),text('fabric','Physical fabric / failure domain'),
  ref('adapter','iSCSI Ethernet adapter','adapters'),ref('network','iSCSI interface network','networks'),text('driver','HBA / NIC driver and firmware'),
  notes('qualification','Interface, vendor DSM and physical-path qualification'),text('observedAt','Storage interface observation (UTC)'),notes('evidence','Initiator inventory evidence'),
]}
export const storageV20Fields=[['disks',physicalStorageFields],['storageSystems',storageOwnershipFields],['sanPaths',sanRouteFields],['storageAllocations',storageAttachmentFields]]as const
