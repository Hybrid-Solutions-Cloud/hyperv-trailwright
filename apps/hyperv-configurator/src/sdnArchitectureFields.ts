import type {Field} from './catalog'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
export const sdnArchitectureFields:Field[]=[
 select('controllerRelease','Controller Windows Server release',{ws2019:'Windows Server 2019',ws2022:'Windows Server 2022',ws2025:'Windows Server 2025',other:'Other — compatibility review required'}),
 text('controllerBuild','Controller OS build (numeric)'),
 select('deploymentTool','Controller deployment tool',{vmm:'VMM service template',sdnexpress:'SDN Express',wac:'Windows Admin Center',manual:'Manual PowerShell procedure',existing:'Existing controller — preserve'}),
 text('deploymentToolBuild','Exact deployment tool version (numeric)'),text('wacExtensionVersion','Windows Admin Center SDN extension version'),
 select('controllerVmMode','Controller service redundancy',{single:'Single controller VM',three:'Three controller VMs',custom:'Custom controller VM topology — review required'}),
 {key:'controllerVmCount',label:'Custom controller VM count',type:'number',min:0,max:100,when:{key:'controllerVmMode',values:['custom']}},
 select('controllerVmGeneration','Controller VM generation',{'1':'Generation 1','2':'Generation 2'}),
 select('controllerVmAvailability','Controller VM hosting availability',{standalone:'Independent Hyper-V hosts',clustered:'Highly available VMs on a failover cluster'}),
 select('controllerRestMode','Multi-node controller REST endpoint',{address:'Reserved REST IP — one management subnet',dns:'REST DNS name — multiple management subnets'}),
 text('vmmHostGroupId','Dedicated VMM SDN host group ID'),text('vmmTemplateSource','VMM template source and immutable revision'),text('vmmTemplateHash','Imported VMM template SHA256'),
 text('vmmLocalAdminRunAsId','VMM local administrator Run As account ID'),text('vmmManagementRunAsId','VMM domain management Run As account ID'),
 text('managementSecurityGroup','Controller management AD security group'),text('clientSecurityGroup','Controller clients AD security group'),
]
export const sdnArchitectureKeys=sdnArchitectureFields.map(f=>f.key)
