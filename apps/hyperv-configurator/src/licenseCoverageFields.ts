import type {Field,Collection} from './catalog'
const text=(key:string,label:string,required=true):Field=>({key,label,type:'text',required})
const notes=(key:string,label:string,required=true):Field=>({key,label,type:'notes',required})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options,required:true})
const ref=(key:string,label:string,collection:string,required=true):Field=>({key,label,type:'reference',collection,required})
const when=(field:Field,key:string,...values:string[]):Field=>({...field,when:{key,values}})
const identity=[text('name','Name'),text('owner','Owner')]
const collection=(key:string,title:string,singular:string,description:string,fields:Field[]):Collection=>({key,title,singular,description,section:'licensing',fields:[...identity,...fields]})

export const licenseCoverageCollections:Collection[]=[
  collection('licenseServers','External and management physical license inventory','physical license inventory','Record physical servers outside the Hyper-V host inventory, including dedicated physical management servers and external VM hosts. Inventory adds licensing inputs only; it does not add VM demand or request provisioning.',[
    select('provider','Physical hosting provider',{physical:'Dedicated physical management',hyperv:'External Hyper-V',vsphere:'VMware vSphere',vcd:'VMware Cloud Director',other:'Other reviewed provider'}),
    text('nativeId','Physical server immutable identity'),text('providerScope','Provider / inventory identity boundary'),text('uuid','Physical server SMBIOS UUID',false),
    {key:'sockets',label:'Physical processor count',type:'number',min:1,max:1000000,required:true},{key:'coresPerSocket',label:'Physical cores per processor',type:'number',min:1,max:1000000,required:true},
    when(ref('component','Dedicated physical management component','$components'),'provider','physical'),
    notes('inventoryEvidence','Physical inventory and licensing responsibility evidence'),
  ]),
  collection('licenseCoverage','Resource licensing coverage','resource coverage','Bind reviewed license items to exact resources and normal, maintenance or failover destinations. Links explain coverage and never add another license quantity.',[
    ref('license','Covering license item','licenses'),ref('target','Covered resource','$licenseTargets'),
    select('basis','Coverage mapping basis',{assignment:'Calculated host / VM assignment',manual:'Reviewed manual allocation',provider:'Provider-supplied coverage'}),
    when(ref('assignment','Covering core assignment','licenseAssignments'),'basis','assignment'),
    select('scenario','Placement scenario',{all:'Normal, maintenance and failover',normal:'Normal placement',maintenance:'Maintenance placement',failover:'Failover placement'}),
    select('osClass','Resource OS class',{windows:'Windows Server',otherServer:'Other server OS',nonServer:'Client / non-server OS',appliance:'Appliance / service',notApplicable:'Not applicable after review'}),
    notes('evidence','Resource, destination and coverage review'),
  ]),
  collection('systemCenterConsumers','System Center services using covered estate','System Center service link','VMM and SCOM can use the same reviewed managed-estate license item. These links do not create separate product charges or license the management server OS.',[
    ref('component','Consuming VMM / SCOM component','$components'),ref('license','Managed-estate System Center license','licenses'),notes('estateEvidence','Managed estate, products and customer-boundary evidence'),
  ]),
  collection('sqlLicenseUses','SQL usage and licensing scope','SQL licensing scope','Review each SQL server OSE, all instances and workloads, exact edition/HA and hosting. Included supporting technology needs a qualified System Center estate and an explicit supported workload map.',[
    ref('license','SQL license item','licenses'),ref('component','SQL component','$sqlComponents'),
    select('mode','SQL coverage mode',{included:'Included System Center supporting technology',separate:'Separately licensed SQL',provider:'Provider-supplied SQL'}),
    when(ref('supportingLicense','Supporting System Center license','licenses'),'mode','included'),
    select('workloadScope','SQL workload scope',{supporting:'Supporting management workloads only',mixed:'Management and unrelated workloads',general:'General-purpose workloads'}),
    notes('oseEvidence','All SQL OSEs, instances, reporting roles and assignment scope'),notes('editionHaEvidence','Exact SQL edition, HA features and failover rights review'),notes('hostingEvidence','SQL hosting and outsourcing rights review'),
  ]),
  collection('sqlWorkloads','SQL workload rights map','SQL workload','Map each database or reporting workload to its SQL rights review and actual consuming component. Unrelated workloads prevent automatic supporting-technology credit.',[
    ref('use','SQL licensing scope','sqlLicenseUses'),ref('consumer','Consuming component','$components'),
    select('purpose','SQL workload purpose',{vmm:'VMM database',operational:'SCOM operational database',warehouse:'SCOM data warehouse',acs:'SCOM ACS',reporting:'SCOM reporting',other:'Other workload'}),
    notes('evidence','Database / reporting workload and product-rights evidence'),
  ]),
]
export const licenseCoverageKeys=licenseCoverageCollections.map(c=>c.key)
