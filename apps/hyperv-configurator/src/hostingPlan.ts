import type {Project} from './project'
import type {Finding} from './validation'
import {hostingContractFields,managementNetworksCollection} from './hostingContractFields'
import {validTime} from './discoveryContract'
import {ipv4,cidr} from './networkAddress'

export function hostingPlan(project:Project){
  const findings:Finding[]=[],attachments=project.design.managementNetworks||[]
  const add=(code:string,message:string,recordId:string,fieldKey:string,section='hosting',severity:Finding['severity']='error')=>findings.push({code,message,recordId,fieldKey,section,severity})
  const components=project.components.map(c=>{
    const h=c.hostingDetails,name=c.name||c.product
    const actions=[{key:'createInfrastructure',owner:'infrastructureOwner',label:'infrastructure creation'},{key:'configureGuest',owner:'guestOwner',label:'guest configuration'},{key:'installProduct',owner:'productOwner',label:'product installation'},{key:'integrateProduct',owner:'integrationOwner',label:'integration configuration'}].map(a=>({...a,selected:h[a.key]===true,assignedOwner:String(h[a.owner]||'')}))
    const changing=actions.some(a=>a.selected)
    const require=(key:string,message?:string)=>{if(!String(h[key]||'').trim())add('HOSTING_CONTRACT',name+': '+(message||'Record '+(hostingContractFields.find(f=>f.key===key)?.label||key)+'.'),c.id,key,'hosting',changing?'error':'warning')}
    for(const a of actions)if(a.selected&&!a.assignedOwner.trim())require(a.owner,'Assign the owner of '+a.label+'.')
    if(c.lifecycle==='preserve'&&changing)add('HOSTING_PRESERVE',name+': Use existing preserves the resource. Choose Configure existing before selecting a configuration action.',c.id,'lifecycle','management')
    if(c.product==='ome'&&actions.some(a=>a.selected&&a.key!=='integrateProduct'))add('OME_MANUAL_HOSTING',name+': OME import, first boot and appliance installation remain manual; infrastructure/Windows guest/product creation flags cannot authorize them.',c.id,'infrastructureOwner')
    if(c.hosting==='external'){
      require('externalContract')
      if(actions.some(a=>a.selected&&a.key!=='integrateProduct'))add('EXTERNAL_SERVICE_ACTION',name+': An external service contract cannot create its VM, configure its guest OS or install its product.',c.id,'externalContract')
    }else{
      if(c.lifecycle!=='new'){
        require('resourceId');require('currentEvidence');require('currentObservedAt');require('preservation')
        if(h.currentObservedAt&&(!validTime(h.currentObservedAt)||Date.parse(String(h.currentObservedAt))>Date.now()))add('HOSTING_BASELINE_TIME',name+': Supply a valid, non-future UTC resource observation.',c.id,'currentObservedAt')
      }
      if(c.hosting==='physical'){
        for(const key of ['physicalInventory','physicalSerial','physicalUuid','physicalModel','physicalBmc','physicalBmcCredentialRef','physicalFirmware','physicalBoot','physicalDisks','physicalNics'])require(key)
      }else if(changing){
        for(const key of ['providerVersion','providerEndpoint','providerCredentialRef','poolId'])require(key)
        if(c.hosting==='vsphere'||c.hosting==='vcd')require('datacenterId')
        if(h.createInfrastructure){require('datastoreId');require('templateId');if(c.hosting==='vcd')require('folderId')}
      }
      if(h.configureGuest)require('guestAcceptance')
    }
    if(changing&&c.product!=='ome')for(const key of ['consumer','consumerVersion','consumerEvidence'])require(key)
    if(h.consumerVersion&&/^(latest|current|main|master|head|\*|~|\^)/i.test(String(h.consumerVersion)))add('HOSTING_FLOATING_CONSUMER',name+': Pin an immutable consumer version; floating versions cannot define a repeatable handoff.',c.id,'consumerVersion')
    return {componentId:c.id,name,product:c.product,lifecycle:c.lifecycle,hosting:c.hosting,resourceId:String(h.resourceId||''),physicalInventory:String(h.physicalInventory||''),actions,contract:Object.fromEntries(hostingContractFields.map(f=>[f.key,h[f.key]??''])),attachmentIds:attachments.filter(a=>a.values.component===c.id).map(a=>a.id),executionReady:false}
  })
  const duplicates=new Map<string,string>(),adapterIds=new Set<string>(),macs=new Set<string>()
  for(const a of attachments){
    const v=a.values,name=String(v.name||'Component attachment'),c=project.components.find(c=>c.id===v.component),n=project.design.networks.find(n=>n.id===v.network)
    const error=(code:string,message:string,key:string,severity:Finding['severity']='error')=>add(code,name+': '+message,a.id,key,'network',severity)
    if(!c)error('COMPONENT_NETWORK_TARGET','Select a current management component.','component')
    if(!n)error('COMPONENT_NETWORK_REFERENCE','Select a current design network.','network')
    if(c?.hosting==='external')error('COMPONENT_NETWORK_EXTERNAL','An external service has no locally managed guest adapter; retain its network path in the service contract.','component')
    if(c?.lifecycle==='preserve'&&['new','configure'].includes(String(v.lifecycle)))error('COMPONENT_NETWORK_PRESERVE','The component is preserved; its adapters cannot have a new/configure action.','lifecycle')
    for(const key of ['owner','lifecycle','providerNetworkId','addressing','acceptance'])if(!String(v[key]||'').trim())error('COMPONENT_NETWORK_INPUT','Record '+(managementNetworksCollection.fields.find(f=>f.key===key)?.label||key)+'.',key)
    if(v.currentId){const key=String(v.component)+':'+String(v.currentId).trim();if(adapterIds.has(key))error('COMPONENT_NETWORK_ADAPTER_DUPLICATE','The same existing adapter is listed twice for this component.','currentId');else adapterIds.add(key)}
    if(v.mac&&n){const key=n.id+':'+String(v.mac).toLowerCase().replace(/[:-]/g,'');if(macs.has(key))error('COMPONENT_NETWORK_MAC_DUPLICATE','Another attachment on this design network has the same MAC address.','mac');else macs.add(key)}
    if(['preserve','configure'].includes(String(v.lifecycle))&&!v.currentId)error('COMPONENT_NETWORK_ID','An existing attachment requires its immutable adapter ID.','currentId')
    if(v.lifecycle==='configure'&&!v.preservation)error('COMPONENT_NETWORK_SCOPE','Record existing-address and connectivity preservation checks.','preservation')
    if(v.addressing==='static'){
      const range=cidr(String(v.ip)),network=n?cidr(String(n.values.cidr)):null,address=ipv4(String(v.ip).split('/')[0])
      if(!range||address===null)error('COMPONENT_NETWORK_IP','Enter a valid IPv4 address with prefix.','ip')
      else{
        if(network&&(range.first!==network.first||range.prefix!==network.prefix))error('COMPONENT_NETWORK_SUBNET','The address/prefix must match the selected design subnet.','ip')
        if(range.prefix<31&&(address===range.first||address===range.last))error('COMPONENT_NETWORK_RESERVED','Use a host address rather than the subnet or broadcast address.','ip')
        if(v.gateway){const gateway=ipv4(String(v.gateway));if(gateway===null||gateway<range.first||gateway>range.last||gateway===address||(range.prefix<31&&(gateway===range.first||gateway===range.last)))error('COMPONENT_NETWORK_GATEWAY','Gateway must be a different usable IPv4 address in the selected subnet.','gateway')}
        const scope=String(n?.values.routingScope||'')
        if(scope){const key=scope.toLowerCase()+':'+address;if(duplicates.has(key))error('COMPONENT_NETWORK_DUPLICATE','Another component attachment uses this address in the same routing scope.','ip');else duplicates.set(key,a.id)}
        else error('COMPONENT_NETWORK_ROUTING_SCOPE','Select a network with an explicit routing scope before checking address uniqueness.','network','warning')
      }
    }
    if(v.dns&&String(v.dns).split(/[\s,;]+/).filter(Boolean).some(address=>ipv4(address)===null))error('COMPONENT_NETWORK_DNS','Use IPv4 DNS server addresses separated by whitespace, commas or semicolons.','dns')
  }
  return {kind:'hyperv-component-hosting-plan',version:'0.1.0',projectId:project.id,revision:project.revision,meaning:'Provider identities and ownership are design inputs. No VM/server creation, guest changes or network operations occur; every consumer still needs its own qualification and authorized targets.',components,attachments,findings}
}
