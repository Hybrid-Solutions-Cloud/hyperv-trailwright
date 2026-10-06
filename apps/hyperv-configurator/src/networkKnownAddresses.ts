import type {Project} from './project'
import type {DesignRecord} from './catalog'
import type {Finding} from './validation'
import {ipv4,cidr} from './networkAddress'
export interface KnownNetworkAddress {recordId:string;fieldKey:string;section:string;targetId:string;networkId:string;scope:string;address:number;literal:string;source:'host'|'component'|'cluster'|'sdn'|'sdnFabric'|'sdnFrontend'}
/** Additional declared addresses for the typed network allocator; observations never overwrite desired inputs. */
export function networkKnownAddresses(project:Project){
 const addresses:KnownNetworkAddress[]=[],findings:Finding[]=[]
 const add=(row:DesignRecord,key:string,section:string,targetId:string,networkId:string,literal:string,source:KnownNetworkAddress['source'])=>{
  const network=project.design.networks.find(n=>n.id===networkId),address=ipv4(literal),range=network&&cidr(String(network.values.cidr))
  if(address===null){if(literal)findings.push({code:'NETWORK_EXISTING_ADDRESS_FORMAT',section,recordId:row.id,fieldKey:key,severity:'error',message:'Use a valid IPv4 address for scoped management address review.'});return}
  if(!network){findings.push({code:'NETWORK_EXISTING_ADDRESS_SCOPE',section,recordId:row.id,fieldKey:key,severity:'warning',message:'Map this declared address to one explicit management network before scoped collision and capacity review.'});return}
  if(range&&(address<range.first||address>range.last||(range.prefix<31&&(address===range.first||address===range.last))))findings.push({code:'NETWORK_EXISTING_ADDRESS_SUBNET',section,recordId:row.id,fieldKey:key,severity:'error',message:'The declared management address must be usable inside its mapped network.'})
  const scope=String(network.values.routingScope).trim().toLowerCase()||network.id
  addresses.push({recordId:row.id,fieldKey:key,section,targetId,networkId,scope,address,literal,source})
 }
 for(const host of [...project.design.hosts].sort((a,b)=>a.id.localeCompare(b.id))){
  const ip=String(host.values.managementIp||'').trim();if(!ip)continue
  const cluster=project.design.clusters.find(c=>c.id===host.values.cluster)
  const interfaceNetworkIds=[...new Set(project.design.hostVnics.filter(n=>n.values.host===host.id&&project.design.networks.some(net=>net.id===n.values.network&&net.values.purpose==='management')).map(n=>String(n.values.network)))]
  const adapter=project.design.adapters.find(a=>a.id===host.values.managementAdapter&&a.values.host===host.id)
  const networkId=String(cluster?.values.managementNetwork||adapter?.values.network||'')||(interfaceNetworkIds.length===1?interfaceNetworkIds[0]:'')
  add(host,'managementIp','hardware',host.id,networkId,ip,'host')
 }
 for(const nic of [...project.design.managementNetworks].sort((a,b)=>a.id.localeCompare(b.id))){if(nic.values.addressing==='static')add(nic,'ip','network',String(nic.values.component),String(nic.values.network),String(nic.values.ip).split('/')[0],'component')}
 for(const cluster of [...project.design.clusters].sort((a,b)=>a.id.localeCompare(b.id)))if(cluster.values.address)add(cluster,'address','topology',cluster.id,String(cluster.values.managementNetwork||''),String(cluster.values.address),'cluster')
 if(project.sdn.scope!=='none')for(const resource of [...project.design.sdnResources].sort((a,b)=>a.id.localeCompare(b.id)))if(resource.values.managementIp)add(resource,'managementIp','sdn',String(resource.values.role==='hostcontroller'&&resource.values.host||resource.id),String(resource.values.managementNetwork||resource.values.providerNetwork||''),String(resource.values.managementIp),'sdn')
 if(project.sdn.scope!=='none'&&project.sdn.details.restIp&&!(project.sdn.architecture==='controller-vms'&&project.sdn.details.controllerVmMode!=='single'&&project.sdn.details.controllerRestMode==='dns'))add({id:'sdn-fabric:'+project.id,values:{...project.sdn.details,name:'Controller REST endpoint'}},'restIp','sdn',project.sdn.architecture==='controller-vms'&&project.sdn.details.controllerVmMode==='single'&&project.design.sdnResources.filter(r=>r.values.role==='controller').length===1?project.design.sdnResources.find(r=>r.values.role==='controller')!.id:'sdn-fabric:'+project.id,String(project.sdn.details.managementNetwork||''),String(project.sdn.details.restIp),'sdnFabric')
 if(project.sdn.scope!=='none')for(const frontend of [...project.design.sdnFrontends].sort((a,b)=>a.id.localeCompare(b.id)))if(frontend.values.address)add(frontend,'address','sdn',frontend.id,String(frontend.values.network),String(frontend.values.address),'sdnFrontend')
 return {addresses,findings}
}
