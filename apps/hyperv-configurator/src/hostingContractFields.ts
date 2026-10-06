import type {Field,Collection} from './catalog'

const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
export const hostingContractFields:Field[]=[
  text('resourceId','Existing immutable VM / server / service ID'),text('currentEvidence','Current resource identity and configuration evidence'),text('currentObservedAt','Current resource observation time (UTC)'),
  text('providerCredentialRef','Hosting provider runtime credential reference'),
  text('datacenterId','Provider datacenter / organization ID'),text('poolId','Provider cluster / resource pool / Org VDC ID'),text('folderId','Provider folder / vApp ID'),text('datastoreId','Provider datastore / storage policy ID'),text('templateId','Provider image / template / catalog item ID'),
  text('physicalInventory','Physical server inventory / evidence reference'),text('physicalSerial','Physical server serial / service tag'),text('physicalUuid','Physical server SMBIOS UUID'),text('physicalModel','Physical server vendor / model'),
  text('physicalBmc','Physical server BMC address'),text('physicalBmcCredentialRef','Physical server BMC runtime credential reference'),notes('physicalFirmware','Physical server firmware / BIOS / BMC baseline'),
  notes('physicalBoot','Physical server boot mode, boot disk, RAID and OS partition layout'),notes('physicalDisks','Physical server disks / controllers / data ownership'),notes('physicalNics','Physical server NIC identities, MACs, roles and driver baseline'),
  text('infrastructureOwner','Infrastructure creation owner'),text('guestOwner','Guest configuration owner'),text('productOwner','Product installation owner'),text('integrationOwner','Integration configuration owner'),
  text('consumer','Hosting / guest consumer name'),text('consumerVersion','Hosting / guest consumer pinned version'),notes('consumerEvidence','Provider contract, qualification and target boundary evidence'),
  notes('preservation','Existing resource and workload preservation checks'),notes('guestAcceptance','Guest identity, OS, network and access acceptance'),
  notes('externalContract','External service scope, owner and acceptance contract'),
]
export const managementNetworksCollection:Collection={key:'managementNetworks',title:'Management component network attachments',singular:'component network attachment',section:'network',description:'Map each VM/server attachment to a design network and exact provider identity. These records do not create or move an adapter.',fields:[
  {...text('name','Attachment name'),required:true},text('owner','Attachment owner'),
  {key:'component',label:'Management component',type:'reference',collection:'$components',required:true},
  {key:'network',label:'Design network',type:'reference',collection:'networks',required:true},
  select('lifecycle','Attachment lifecycle',{preserve:'Preserve existing',configure:'Configure existing',new:'Create new attachment'}),
  text('currentId','Existing adapter immutable ID'),text('providerNetworkId','Provider switch / port group / network ID'),text('adapterName','Guest adapter name'),text('mac','MAC address'),
  select('addressing','IP assignment',{static:'Static',dhcp:'DHCP with reviewed reservation / policy'}),text('ip','IPv4 address / prefix'),text('gateway','Default gateway'),text('dns','DNS servers'),text('vlan','VLAN / provider isolation mapping'),
  notes('preservation','Preservation and change scope'),notes('acceptance','Address, DNS, routing and isolation acceptance'),
]}
export const additionalProducts={admin:'Administration / jump host',backup:'Backup service',patching:'Patching service',integration:'Other management integration'} as const
export const additionalProductFields:Record<string,Field[]>={
  admin:[text('access','Administrative access path / protocol'),notes('roles','Operator roles, privileged access and session controls'),notes('tools','Installed administration tools and versions'),notes('roleAcceptance','Administrative access and recovery acceptance')],
  backup:[text('engine','Backup product and exact version'),text('repository','Backup repository / service contract'),notes('scope','Protected components, data and exclusions'),notes('schedule','Backup windows, retention and immutable copy policy'),notes('roleAcceptance','Restore sequence and measured recovery acceptance')],
  patching:[text('engine','Patching product and exact version'),notes('scope','Managed components and delegated authority'),notes('rings','Patch rings, maintenance windows and approval'),notes('roleAcceptance','Maintenance, rollback and service acceptance')],
  integration:[text('vendor','Integration vendor / product'),text('endpoint','Integration endpoint / service contract'),text('version','Exact integration build / API version'),text('credentialRef','Integration runtime credential reference'),notes('scope','Source, destination, allowed operations and ownership'),notes('support','Version-specific support and consumer evidence'),notes('roleAcceptance','Integration, failure and recovery acceptance')],
}
