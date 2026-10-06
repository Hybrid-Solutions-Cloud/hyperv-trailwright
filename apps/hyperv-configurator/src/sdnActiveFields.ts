import {visibleField} from './catalog'
import type {Field} from './catalog'
import type {Project} from './project'
import {sdnFabricFields} from './sdnFields'
/** Architecture and ownership determine active inputs; project saves retain hidden answers. */
export function activeSdnFields(sdn:Project['sdn']):Field[]{
 const vm=sdn.architecture==='controller-vms',vmm=vm&&sdn.owner==='vmm'
 const vmKeys=['controllerRestMode','controllerVmMode','controllerVmCount','controllerVmGeneration','controllerVmAvailability','managementSecurityGroup','clientSecurityGroup']
 const fcncKeys=['sharedVolume','databasePath','binaryPath']
 return sdnFabricFields.filter(f=>(f.key!=='controllerRestMode'||sdn.details.controllerVmMode!=='single')&&(f.key!=='restIp'||!vm||sdn.details.controllerVmMode==='single'||sdn.details.controllerRestMode!=='dns')&&visibleField(f,sdn.details)&&(!vmKeys.includes(f.key)||vm)&&(!fcncKeys.includes(f.key)||!vm)&&(!f.key.startsWith('vmm')||vmm)&&(f.key!=='wacExtensionVersion'||sdn.details.deploymentTool==='wac')).map(f=>f.key==='controllerCluster'?{...f,label:vm?'Controller hosting cluster / host group':'Controller hosting cluster'}:f)
}
export const activeSdnDetails=(sdn:Project['sdn'])=>Object.fromEntries(activeSdnFields(sdn).map(f=>[f.key,sdn.details[f.key]]))
