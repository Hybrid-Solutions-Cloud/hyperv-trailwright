import {sdnFixture} from './sdnFixture'
import {newComponent} from '../project'
export function sdnVmFixture(mode:'single'|'three'='three'){
 const {project,add}=sdnFixture();project.sdn.architecture='controller-vms';project.sdn.owner='vmm';project.sdn.toolVersion='VMM 2025 (example)'
 const vmm=newComponent('vmm');vmm.id='example-vmm';project.components.push(vmm)
 Object.assign(project.sdn.details,{deploymentTool:'vmm',deploymentToolBuild:'2025',controllerVmMode:mode,controllerVmGeneration:'2',controllerVmAvailability:'standalone',controllerRestMode:'address',managementSecurityGroup:'EXAMPLE\\NCManagement',clientSecurityGroup:'EXAMPLE\\NCClients',vmmComponent:vmm.id,vmmServiceTemplateId:'example-template',vmmLogicalNetworkId:'example-management',vmmLogicalSwitchId:'example-switch',vmmHostGroupId:'example-host-group',vmmTemplateSource:'EXAMPLE source revision',vmmTemplateHash:'a'.repeat(64),vmmLocalAdminRunAsId:'example-local-run-as',vmmManagementRunAsId:'example-domain-run-as',image:'example-image',vmLocation:'EXAMPLE VM location'})
 project.design.clusters[0].values.topology='standalone';project.design.sdnResources=[]
 add('media','example-image',{kind:'vhdx'})
 if(mode==='three'){add('hosts','sdn-host-3',{cluster:'sdn-cluster'});add('hostSwitches','sdn-switch-3',{host:'sdn-host-3'});add('sdnHostBindings','sdn-binding-3',{host:'sdn-host-3',hostSwitch:'sdn-switch-3',providerNetwork:'sdn-provider',lifecycleOwner:'vmm',preservation:'EXAMPLE preserve switch',readiness:'EXAMPLE prerequisite review',connectivity:'EXAMPLE connectivity review'})}
 for(const binding of project.design.sdnHostBindings)binding.values.lifecycleOwner='vmm'
 for(let i=1;i<=(mode==='three'?3:1);i++)add('sdnResources','controller-'+i,{role:'controller',cluster:'sdn-cluster',host:'sdn-host-'+i,lifecycle:'create',lifecycleOwner:'vmm',failureDomain:'Example rack '+i,managementNetwork:'sdn-management',managementIp:mode==='single'?'192.0.2.10':'192.0.2.'+(20+i),vCpu:4,memoryGiB:8,diskGiB:80,prerequisites:'EXAMPLE VM and group prerequisite review'})
 return {project,add}
}
