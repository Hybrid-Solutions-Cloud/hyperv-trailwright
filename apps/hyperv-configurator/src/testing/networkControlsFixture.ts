import {networkFixture} from './networkFixture'
export function networkControlsFixture(){
 const {project,add}=networkFixture()
 for(let i=1;i<=2;i++){
  add('networkTrafficClasses',`default-${i}`,{host:`host-net-${i}`,name:'Default',authority:'atc',kind:'default',priorities:'0-2,4-6',algorithm:'ets',bandwidthPercent:48,pfc:'disabled',classification:'EXAMPLE default traffic',physicalAcceptance:'EXAMPLE physical QoS review'})
  add('networkTrafficClasses',`smb-${i}`,{host:`host-net-${i}`,name:'SMB',authority:'atc',kind:'custom',priorities:'3',algorithm:'ets',bandwidthPercent:50,pfc:'enabled',classification:'EXAMPLE SMB marking',physicalAcceptance:'EXAMPLE physical QoS review'})
  add('networkTrafficClasses',`cluster-${i}`,{host:`host-net-${i}`,name:'Cluster',authority:'atc',kind:'custom',priorities:'7',algorithm:'ets',bandwidthPercent:2,pfc:'disabled',classification:'EXAMPLE heartbeat marking',physicalAcceptance:'EXAMPLE physical QoS review'})
  Object.assign(project.design.hostVnics[i-1].values,{trafficClass:`default-${i}`,priority:0,bandwidthPercent:48,pfc:'disabled'})
  project.design.hostSwitches[i-1].values.managementRecovery='EXAMPLE reviewed OOB management recovery'
 }
 return {project,add}
}
