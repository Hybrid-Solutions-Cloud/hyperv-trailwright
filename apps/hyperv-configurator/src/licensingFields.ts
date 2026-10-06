import type {Field,Collection} from './catalog'

const text=(key:string,label:string,required=false):Field=>({key,label,type:'text',required})
const notes=(key:string,label:string,required=false):Field=>({key,label,type:'notes',required})
const select=(key:string,label:string,options:Record<string,string>,required=false):Field=>({key,label,type:'select',options,required})
const number=(key:string,label:string):Field=>({key,label,type:'number',min:0,max:1e9})
const when=(field:Field,key:string,...values:string[]):Field=>({...field,when:{key,values}})
const core=(field:Field):Field=>when(field,'calculationModel','physical','virtual')

export const licensePlanningFields:Field[]=[
  select('calculationModel','Quantity calculation',{manual:'Reviewed manual quantity',physical:'Physical-core Windows / System Center',virtual:'Per-VM Windows / System Center'},true),
  core(select('coreEdition','Core license edition',{standard:'Standard',datacenter:'Datacenter'},true)),
  core(select('unitBasis','Quoted unit size',{core:'One core license',pack2:'Two-core pack',pack16:'Sixteen-core pack'},true)),
  core(select('ruleProfile','Reviewed licensing rule profile',{commercial2025:'Microsoft Commercial Licensing 2025'},true)),
  text('customerScope','Customer / license assignment boundary',true),
  when(select('vmEligibility','Per-VM licensing eligibility',{sa:'Active Software Assurance',subscription:'Eligible subscription',review:'Unresolved'},true),'calculationModel','virtual'),
  when(notes('customerMinimumReview','Complete customer core-license pool review',true),'calculationModel','virtual'),
  text('entitlementId','Existing entitlement pool ID'), number('entitlementTotalUnits','Total units in this entitlement pool'),
  notes('assignmentReview','Quantity / entitlement assignment review',true), text('reviewedAt','Licensing review date (YYYY-MM-DD)',true),
  select('quoteStatus','Quote status',{review:'Not yet quoted',quoted:'Dated price quote',nocharge:'Confirmed no additional charge'},true),
  text('quoteSource','Quote / no-charge evidence reference'),
]

export const licenseAssignmentsCollection:Collection={key:'licenseAssignments',title:'License assignment and failover scope',singular:'license assignment',section:'licensing',description:'Link each calculated license item to exact physical hosts or server VMs. Record peak OSE placement for every possible destination, including maintenance and failover hosts. These are reviewed licensing assumptions, not deployment placement changes.',fields:[
  text('name','Name',true),text('owner','Owner',true),{key:'license',label:'License item',type:'reference',collection:'licenses',required:true},
  select('kind','Assignment target type',{host:'Physical server',vm:'Server VM'},true),
  when({key:'host',label:'Licensed physical host',type:'reference',collection:'$licensePhysicalServers',required:true},'kind','host'),
  when({...number('peakVirtualOSEs','Peak virtual OSEs on this host'),hint:'Windows: Windows Server OSEs / Windows containers with Hyper-V isolation. System Center: managed server OSEs. Include peak maintenance/failover arrivals.'},'kind','host'),
  when(select('physicalOSE','Physical OSE use',{ 'hosting-only':'Solely hosts / manages virtual OSEs',other:'Also runs or manages another counted physical OSE',absent:'No counted physical OSE'},true),'kind','host'),
  when({key:'vm',label:'Licensed server VM',type:'reference',collection:'$licenseVMs',required:true},'kind','vm'),
  when(select('osClass','VM operating system class',{windows:'Windows Server',other:'Other server OS (System Center support review)'},true),'kind','vm'),
  notes('placementReview','Normal / maintenance / failover assignment evidence',true),
]}
