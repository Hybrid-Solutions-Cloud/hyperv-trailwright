import {sdnArchitectureFields} from './sdnArchitectureFields'
import type {Collection,Field} from './catalog'
import {sdnServiceKeys} from './sdnServiceFields'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const bool=(key:string,label:string):Field=>({key,label,type:'boolean'})
export const sdnIntents={design:'Design only',handoff:'Prepare deployment handoff',qualified:'Use existing external automation'}
export const sdnOwners={operator:'Operator',vmm:'VMM',powershell:'PowerShell / SDN Express',existing:'Existing fabric owner'}
const lifecycle=select('lifecycle','Object lifecycle',{preserve:'Preserve existing',adopt:'Document existing',configure:'Configure existing',create:'Create new',expand:'Expand existing',replace:'Replace (requires separate qualification)'})
export const sdnFabricFields:Field[]=[
 ...sdnArchitectureFields,
 select('intent','SDN delivery intent',sdnIntents),bool('isolation','Virtual tenant isolation required'),bool('policy','Distributed security policy required'),bool('nat','Outbound NAT required'),bool('routing','Routed tenant connectivity required'),bool('tunnels','Site-to-site tunnels required'),
 text('fabricId','Existing native fabric identifier'),notes('baseline','Existing fabric baseline / preservation evidence'),notes('changeScope','Exact intended SDN changes'),notes('compatibilityEvidence','Architecture and tool compatibility evidence'),
 ref('controllerCluster','Controller hosting cluster','clusters'),ref('managementNetwork','Controller management network','networks'),text('restIp','Controller REST management IPv4 address'),text('restName','Controller REST DNS name'),
 ref('providerNetwork','HNV provider network','networks'),ref('publicVipNetwork','Public VIP network','networks'),ref('privateVipNetwork','Private VIP network','networks'),text('macPoolStart','SDN client MAC pool start'),text('macPoolEnd','SDN client MAC pool end'),
 ref('domainIdentity','SDN domain identity','identities'),ref('controllerIdentity','Controller service identity','identities'),ref('runnerIdentity','SDN deployment identity','identities'),ref('certificateIdentity','Controller certificate identity','identities'),
 ref('image','SDN VM image artifact','media'),text('vmLocation','SDN VM storage location'),ref('sharedVolume','FCNC shared database volume','volumes'),text('databasePath','FCNC shared database path'),text('binaryPath','FCNC binary path'),
 ref('vmmComponent','Owning VMM service','$components'),text('vmmServiceTemplateId','VMM controller service template ID'),text('vmmLogicalNetworkId','VMM management logical network ID'),text('vmmLogicalSwitchId','VMM logical switch ID'),
 notes('physicalAcceptance','Physical routing / MTU / VLAN / firewall acceptance'),notes('availability','Controller and NFV count / failure-domain rationale'),notes('monitoring','SDN health / alert ownership and acceptance'),
]
const ownership:Field[]=[select('lifecycleOwner','Native object lifecycle owner',sdnOwners),text('nativeId','Existing native object identifier'),notes('baseline','Object baseline / preservation evidence')]
export const sdnRecordFields:readonly (readonly [string,Field[]])[]=[
 ['sdnResources',[...ownership,ref('host','Exact hosting / overhead host','hosts'),ref('managementNetwork','SDN resource management network','networks'),ref('image','Resource image artifact','media'),notes('prerequisites','Role prerequisites / identity / connectivity acceptance')]],
 ['bgpPeers',[lifecycle,...ownership,ref('resource','Local SDN routing resource','sdnResources'),ref('network','BGP transport network','networks'),notes('routeAcceptance','Expected prefixes / filtering / route withdrawal acceptance')]],
 ['tenantServices',[lifecycle,...ownership,ref('gatewayResource','Gateway resource','sdnResources'),ref('vipNetwork','Service VIP network','networks'),notes('dependencies','Tenant service dependencies and ordered acceptance')]],
]
export const sdnCollections:Collection[]=[{
 key:'sdnHostBindings',title:'SDN host participation',singular:'SDN host binding',section:'sdn',description:'Bind each participating host to its switch and provider network. Readiness notes are declared prerequisites, not returned runtime evidence.',fields:[
 text('name','Name'),text('owner','Owner'),ref('host','Participating Hyper-V host','hosts'),ref('hostSwitch','SDN host virtual switch','hostSwitches'),ref('providerNetwork','Host HNV provider network','networks'),
 select('lifecycleOwner','Host SDN configuration owner',sdnOwners),notes('preservation','Existing host networking preservation / exact changes'),notes('readiness','Hyper-V / NC / RSAT / restart / AD / switch prerequisites'),notes('connectivity','Controller / provider / physical connectivity acceptance'),
 ]
}]
export const sdnCollectionKeys=['sdnResources','bgpPeers','tenantServices',...sdnCollections.map(c=>c.key),...sdnServiceKeys]
