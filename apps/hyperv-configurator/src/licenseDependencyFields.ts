import type {Field,Collection} from './catalog'
const text=(key:string,label:string):Field=>({key,label,type:'text',required:true})
const notes=(key:string,label:string):Field=>({key,label,type:'notes',required:true})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options,required:true})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection,required:true})
const number=(key:string,label:string):Field=>({key,label,type:'number',min:0,max:1e9,required:true})
const when=(field:Field,key:string,...values:string[]):Field=>({...field,when:{key,values}})
const common=[text('name','Name'),text('owner','Owner'),ref('license','Covering license item','licenses')]
const collection=(key:string,title:string,singular:string,description:string,fields:Field[]):Collection=>({key,title,singular,description,section:'licensing',fields:[...common,...fields]})

export const licenseDependencyCollections:Collection[]=[
  collection('accessRights','Access rights and audiences','access rights scope','Review actual access, distinct audiences and applicable CAL, RDS, SAL or alternative rights. One item covers one reviewed audience; users and devices are not inferred from VM counts.',[
    select('kind','Access right',{windows:'Windows Server base access',rds:'RDS additive access',sal:'Provider subscriber access',other:'Other reviewed access'}),
    select('metric','Access counting unit',{user:'Distinct users',device:'Distinct devices',server:'External Connector servers',other:'Other reviewed units'}),
    text('audience','Stable audience / server scope identifier'),number('quantity','Reviewed audience units'),notes('actualUse','Actual access, identities, endpoints and exclusions'),
    when(ref('baseLicense','Covering Windows base access item','licenses'),'kind','rds'),
    notes('versionEvidence','Product version, CAL suite equivalence and agreement review'),notes('scopeEvidence','Audience allocation and overlap review'),
  ]),
  collection('azureLicenseMeters','Azure service meters and benefits','Azure service meter','Record each enabled service and exact meter, region, resource scope and charge period. Meter quantities and quotes are entered from reviewed estimates; enabling Arc does not establish free add-on services.',[
    select('service','Azure service',{arc:'Arc core control plane',update:'Update Manager',policy:'Machine configuration / Policy',monitor:'Azure Monitor',defender:'Defender for Cloud',sentinel:'Microsoft Sentinel',other:'Other Azure service'}),
    ref('target','Metered host / guest / resource','$licenseDependencyTargets'),text('scope','Complete billing / resource scope identifier'),text('meter','Exact meter / SKU identifier'),text('region','Meter pricing region'),
    text('unit','Quoted meter unit'),number('quantity','Meter units per charge period'),select('period','Meter charge period',{monthly:'Monthly',annual:'Annual'}),
    number('ingestionGB','Estimated ingestion GB per charge period'),number('retentionDays','Planned retention days'),
    select('benefit','Existing benefit treatment',{none:'No benefit claimed',allocation:'Allocated covered meter units',included:'Reviewed full inclusion'}),
    notes('benefitEvidence','Benefit eligibility, covered units and remaining meters'),notes('usageEvidence','Enabled services, host/guest scope and consumption estimate'),
  ]),
  collection('licenseDependencies','OME, SDN and third-party license dependencies','license dependency','Map each selected feature to its reviewed entitlement. Reuse a license item across covered features without another charge; appliance and host/guest OS rights stay separate.',[
    select('category','Dependency category',{ome:'OME / plugin / iDRAC feature',sdn:'SDN host / VM / network dependency',vmware:'VMware hosting',backup:'Backup',other:'Other third-party dependency'}),
    ref('target','Consuming resource','$licenseDependencyTargets'),text('feature','Feature / plugin / dependency identity'),
    notes('inventoryEvidence','Covered devices, service tags or resource allocation'),notes('versionEvidence','Exact product/plugin versions and required entitlement tier'),notes('coverageEvidence','Existing coverage, prerequisites and exclusions'),
  ]),
]
export const licenseDependencyKeys=licenseDependencyCollections.map(c=>c.key)
