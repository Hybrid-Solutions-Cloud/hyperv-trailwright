import type {Field} from './catalog'

export const omePlugins=[
  {key:'aiops',label:'Dell AIOps',version:'2.7',small:2,large:4},
  {key:'services',label:'Services',version:'4.7',small:8,large:8},
  {key:'update',label:'Update Manager',version:'2.1',small:1,large:1},
  {key:'omevv',label:'OMEVV',version:'1.10',small:5,large:5},
  {key:'scom',label:'Operations Manager integration',version:'1.8',small:3,large:3},
  {key:'vmm',label:'VMM / Configuration Manager integration',version:'1.9',small:1,large:1},
] as const
export const omeMilestones={import:'Appliance import / existing instance identification',firstBoot:'First boot and appliance health',license:'Entitlement and plug-in activation',certificate:'HTTPS certificate and renewal',discovery:'Discovery and inventory acceptance',integration:'Integration functional acceptance',restore:'Backup and restore acceptance',signoff:'Operational handover'} as const
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const num=(key:string,label:string):Field=>({key,label,type:'number',min:0})
export const omePlanningFields:Field[]=[
  select('sizingProfile','Reviewed OME sizing profile',{small:'4.7 small (fewer than 1,000 devices)',large:'4.7 large (1,000–8,000 devices)',extraLarge:'4.7 extra-large (up to 25,000; no plug-ins)',manual:'Other release / independently reviewed sizing'}),
  notes('sizingEvidence','Sizing review evidence and growth assumptions'),
  select('capacityUnits','Reviewed interpretation of vendor GB',{binary:'Vendor GB treated as GiB after review',decimal:'Vendor GB converted from decimal bytes'}),
  num('primaryDiskGiB','OME primary virtual disk (GiB)'),num('secondaryDiskGiB','OME secondary virtual disk (GiB)'),
  notes('storageHeadroom','Datastore free space, snapshot and expansion allowance'),
  ...omePlugins.flatMap(p=>[select('plugin_'+p.key,p.label+' selection',{enabled:'Enabled',disabled:'Disabled'}),text('pluginVersion_'+p.key,p.label+' exact version')]),
  notes('idracTargets','Discovery addresses (one IPv4, DNS name, IPv4 CIDR or IPv4 start-end per line)'),
  text('discoveryCredentialRef','Discovery runtime credential reference'),notes('discoveryProtocols','Discovery protocols, ports and network path review'),
  notes('deviceSupport','Device models / firmware / iDRAC versions and feature support review'),
  notes('firmwareBaseline','Firmware baseline IDs, catalog source, update owner and approval'),
  notes('integrationEvidence','Integration endpoints, versions, identities and acceptance criteria'),
  notes('entitlementEvidence','Device / plug-in rights, agreement and license worksheet references'),
  ...Object.entries(omeMilestones).flatMap(([key,label])=>[
    select('manual_'+key,label+' state',{planned:'Planned',reported:'Operator reports accepted',notApplicable:'Not applicable after review'}),
    text('manualOwner_'+key,label+' owner'),notes('manualEvidence_'+key,label+' evidence / exclusion reason'),text('manualAt_'+key,label+' observation time (UTC)'),
  ]),
]
