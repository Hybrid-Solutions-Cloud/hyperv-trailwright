import {visibleField,type DesignRecord} from './catalog'
import type {Project} from './project'
import type {Finding} from './validation'
import {referenceOptions} from './references'
import {licenseCoverageCollections} from './licenseCoverageFields'
import {licenseDependencyPlan} from './licenseDependencies'

const value=(row:DesignRecord|undefined,key:string)=>String(row?.values[key]??'').trim()
const known=(s:string)=>!!s&&!/^withheld for sharing|^secret-ref:\/\/withheld\//i.test(s)
const normalized=(s:string)=>s.trim().toLowerCase()
export type CoverageFinding=Finding&{licenseIds:string[]}
export const LICENSE_COVERAGE_SOURCES={reviewedAt:'2026-09-11',urls:[
  'https://www.microsoft.com/en-us/licensing/product-licensing/system-center',
  'https://www.microsoft.com/licensing/terms/en-US/productoffering/SystemCenterServer/OL',
  'https://www.microsoft.com/licensing/guidance/Server_Virtualization',
  'https://www.microsoft.com/en-us/licensing/product-licensing/client-access-license',
  'https://www.microsoft.com/licensing/guidance/SPLA',
  'https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/rds-client-access-license',
  'https://azure.microsoft.com/en-us/pricing/details/azure-arc/core-control-plane/',
  'https://azure.microsoft.com/en-us/pricing/details/monitor/',
  'https://www.dell.com/support/manuals/en-us/dell-openmanage-enterprise/ome_4_4_online_help_user_guide/licensing?guid=guid-615a018a-ebd8-4352-92e0-f7b532dbfa7f',
]}

export function licenseCoveragePlan(project:Project){
  const dependencyPlan=licenseDependencyPlan(project)
  const findings:CoverageFinding[]=[...dependencyPlan.findings],licenses=project.design.licenses,assignments=project.design.licenseAssignments
  const coverage=project.design.licenseCoverage,services=project.design.systemCenterConsumers,uses=project.design.sqlLicenseUses,workloads=project.design.sqlWorkloads,servers=project.design.licenseServers
  const license=(id:string)=>licenses.find(l=>l.id===id)
  const affected=(row:DesignRecord)=>value(row,'license')?[value(row,'license')]:value(row,'use')?[value(uses.find(u=>u.id===value(row,'use')),'license')]:assignments.filter(a=>value(a,'host')===row.id).map(a=>value(a,'license'))
  const add=(code:string,row:DesignRecord,key:string,message:string,ids=affected(row),severity:Finding['severity']='error')=>findings.push({code:`LICENSE_COVERAGE_${code}`,section:'licensing',recordId:row.id,fieldKey:key,severity,message:`${value(row,'name')||'License coverage'}: ${message}`,licenseIds:[...new Set(ids.filter(Boolean))]})
  const objects=Object.fromEntries(licenseCoverageCollections.map(c=>[c.key,[...project.design[c.key]].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
    const fields=c.fields.filter(f=>visibleField(f,row.values))
    for(const f of fields){
      const text=value(row,f.key)
      if(f.required&&!known(text))add('REQUIRED',row,f.key,`Record ${f.label.toLowerCase()}.`)
      if(f.collection&&text&&!referenceOptions(project,f.collection).some(r=>r.id===text))add('REFERENCE',row,f.key,`${f.label} must reference an active matching record.`)
      if(f.type==='number'&&(!Number.isSafeInteger(Number(row.values[f.key]))||Number(row.values[f.key])<(f.min??0)))add('INVENTORY',row,f.key,`${f.label} requires a positive whole inventory value.`)
    }
    return {id:row.id,values:Object.fromEntries(fields.map(f=>[f.key,row.values[f.key]]))}
  })]))
  Object.assign(objects,dependencyPlan.objects)
  for(const server of servers){
    const same=servers.filter(r=>normalized(value(r,'providerScope'))===normalized(value(server,'providerScope'))&&normalized(value(r,'nativeId'))===normalized(value(server,'nativeId')))
    if(value(server,'nativeId')&&same.length>1)add('SERVER_DUPLICATE',server,'nativeId','Use one physical inventory record for this provider identity.',same.flatMap(affected))
    if(value(server,'uuid')&&[...project.design.hosts,...servers.filter(r=>r.id!==server.id)].some(r=>normalized(value(r,'uuid'))===normalized(value(server,'uuid'))))add('SERVER_UUID',server,'uuid','This physical UUID already exists in the host/license inventory; reuse one server identity.')
    if(value(server,'provider')==='physical'){
      const component=project.components.find(c=>c.id===value(server,'component'))
      if(component&&component.hosting!=='physical')add('SERVER_COMPONENT',server,'component','A dedicated physical inventory record must identify a physically hosted component.')
      if(component&&servers.some(r=>r.id!==server.id&&value(r,'provider')==='physical'&&value(r,'component')===component.id))add('SERVER_COMPONENT_DUPLICATE',server,'component','Use one physical inventory record for this dedicated server.')
    }
  }
  const mapped=coverage.map(row=>{
    const item=license(value(row,'license')),product=value(item,'product'),a=value(row,'basis')==='assignment'?assignments.find(a=>a.id===value(row,'assignment')):undefined
    const target=project.components.find(c=>c.id===value(row,'target')),targetId=value(row,'target')
    const physicalDestination=a&&value(a,'kind')==='host'?value(a,'host'):''
    if(a&&value(a,'license')!==value(row,'license'))add('ASSIGNMENT_ITEM',row,'assignment','The core assignment belongs to a different license item.')
    if(value(row,'basis')==='assignment'&&item&&!['physical','virtual'].includes(value(item,'calculationModel')))add('ASSIGNMENT_MODEL',row,'basis','A calculated assignment cannot cover a manual license item.')
    if(['manual','provider'].includes(value(row,'basis'))&&item&&value(item,'calculationModel')!=='manual')add('MANUAL_MODEL',row,'basis','Manual/provider mappings require a reviewed manual license item.')
    if(value(row,'basis')==='provider'&&item&&(!known(value(item,'providerRightsEvidence'))||value(item,'context')!=='hosted'))add('PROVIDER',row,'basis','Provider coverage requires a hosted license item and its provider/customer rights evidence.')
    if(a&&value(a,'kind')==='vm'&&value(a,'vm')!==targetId)add('VM_TARGET',row,'target','A per-VM assignment covers only its exact server VM.')
    if(a&&value(a,'kind')==='host'){
      const isVm=referenceOptions(project,'$licenseVMs').some(r=>r.id===targetId)
      const physical=servers.find(s=>s.id===physicalDestination)
      const dedicated=target?.hosting==='physical'&&value(physical,'component')===target.id
      if(targetId!==physicalDestination&&!isVm&&!dedicated)add('HOST_TARGET',row,'target','Map the licensed server, one of its reviewed guest destinations, or its exact dedicated physical component.')
      if(target?.hosting==='external')add('EXTERNAL_TARGET',row,'target','An externally supplied service requires a manual/provider contract; it is not a counted VM.')
    }
    if(product==='windows'&&(value(row,'osClass')!=='windows'||target?.product==='ome'))add('WINDOWS_OS',row,'osClass','Windows coverage requires an explicitly identified Windows Server OSE, not an OME appliance.')
    if(product==='systemcenter'&&item&&value(item,'calculationModel')!=='manual'&&!['windows','otherServer'].includes(value(row,'osClass')))add('SC_OS',row,'osClass','Automatic server management licensing covers server OSEs; review client/device licensing separately.')
    return {id:row.id,licenseId:value(row,'license'),licenseName:value(item,'name'),targetId,targetName:referenceOptions(project,'$licenseTargets').find(t=>t.id===targetId)?.name||targetId,product,basis:value(row,'basis'),assignmentId:a?.id||'',physicalDestination,scenario:value(row,'scenario'),evidence:value(row,'evidence')}
  })
  for(const row of mapped){
    const overlaps=mapped.filter(other=>other.id!==row.id&&other.targetId===row.targetId&&other.product===row.product&&(row.scenario==='all'||other.scenario==='all'||row.scenario===other.scenario)&&!(row.physicalDestination&&other.physicalDestination&&row.physicalDestination!==other.physicalDestination))
    if(overlaps.length)add('DUPLICATE',coverage.find(c=>c.id===row.id)!,'target','Coverage overlaps another mapping for this product, resource and placement scenario; consolidate the allocation.',[row.licenseId,...overlaps.map(r=>r.licenseId)])
  }
  for(const a of assignments.filter(a=>value(a,'kind')==='host')){
    const guestIds=new Set(referenceOptions(project,'$licenseVMs').map(r=>r.id)),rows=mapped.filter(r=>r.assignmentId===a.id&&guestIds.has(r.targetId))
    const maximum=Math.max(0,...['normal','maintenance','failover'].map(s=>new Set(rows.filter(r=>r.scenario==='all'||r.scenario===s).map(r=>r.targetId)).size))
    if(maximum>Number(a.values.peakVirtualOSEs))add('PEAK_OSES',a,'peakVirtualOSEs',`Mapped guests require at least ${maximum} peak virtual OSEs on this destination.`,[value(a,'license')])
  }
  for(const service of services){
    const component=project.components.find(c=>c.id===value(service,'component')),item=license(value(service,'license'))
    if(component&&!['vmm','scom'].includes(component.product))add('SERVICE_PRODUCT',service,'component','Select a VMM or SCOM service that uses the managed-estate license.')
    if(item&&value(item,'product')!=='systemcenter')add('SERVICE_LICENSE',service,'license','The managed-estate item must be System Center; Windows OS coverage is separate.')
    if(item&&!assignments.some(a=>value(a,'license')===item.id)&&!coverage.some(r=>value(r,'license')===item.id))add('SERVICE_ESTATE',service,'estateEvidence','Identify managed servers or an explicit external estate coverage mapping; a service link alone is not a managed-estate quantity.')
    if(services.some(r=>r.id!==service.id&&value(r,'component')===value(service,'component')&&value(r,'license')===value(service,'license')))add('SERVICE_DUPLICATE',service,'component','This service is already linked to this estate; do not add another product charge.')
  }
  const dependencies:{licenseId:string;sourceLicenseId:string;recordId:string}[]=[]
  for(const use of uses){
    const item=license(value(use,'license')),component=project.components.find(c=>c.id===value(use,'component')),children=workloads.filter(w=>value(w,'use')===use.id),included=value(use,'mode')==='included'
    if(item&&(value(item,'product')!=='sql'||value(item,'calculationModel')!=='manual'))add('SQL_ITEM',use,'license','SQL use needs a reviewed manual SQL license item; Windows and System Center formulas do not license SQL.')
    if(component&&component.product!=='sql')add('SQL_COMPONENT',use,'component','Select a SQL component.')
    const duplicate=uses.filter(u=>u.id!==use.id&&value(u,'component')===value(use,'component'))
    if(duplicate.length)add('SQL_DUPLICATE',use,'component','Consolidate the OSE, instances and workloads into one SQL rights record to avoid duplicate coverage or charges.',[...affected(use),...duplicate.flatMap(affected)])
    if(!children.length)add('SQL_WORKLOADS',use,'workloadScope','Map every database/reporting workload before reviewing this SQL scope.')
    if(included){
      const source=license(value(use,'supportingLicense'))
      dependencies.push({licenseId:value(use,'license'),sourceLicenseId:value(use,'supportingLicense'),recordId:use.id})
      if(item&&value(item,'rights')!=='included')add('SQL_MODE',use,'mode','Included SQL mode must match the license item coverage source.')
      if(source&&value(source,'product')!=='systemcenter')add('SQL_SOURCE',use,'supportingLicense','Included supporting SQL requires a System Center estate license.')
      if(source&&value(source,'commercialProgram')!=='commercial')add('SQL_SOURCE_PROGRAM',use,'supportingLicense','Review supporting SQL under the exact commercial System Center agreement; this inclusion does not infer SPLA/OEM/provider rights.')
      if(item&&source&&normalized(value(item,'customerScope'))!==normalized(value(source,'customerScope')))add('SQL_CUSTOMER',use,'supportingLicense','SQL and its supporting System Center estate must use the same reviewed customer boundary.')
      if(item&&value(item,'commercialProgram')!=='commercial')add('SQL_PROGRAM',use,'mode','This included-SQL assessment covers reviewed Microsoft Commercial Licensing; other programs require separately reviewed SQL coverage.')
      if(component&&value({id:component.id,values:component.productDetails},'edition')!=='standard')add('SQL_EDITION',use,'editionHaEvidence','System Center supporting runtime coverage requires the reviewed Standard edition; Enterprise features need separate SQL rights.')
      if(component){
        const groups=project.design.availabilityMembers.filter(m=>value(m,'component')===component.id).map(m=>project.design.availabilityGroups.find(g=>g.id===value(m,'group'))).filter(g=>!!g)
        if(groups.some(g=>value(g,'strategy')==='sqlag'&&value(g,'sqlAgKind')==='full'))add('SQL_ENTERPRISE_FEATURE',use,'editionHaEvidence','A full SQL availability group requires a separate Enterprise rights review; it cannot use this Standard supporting-runtime credit.')
      }
      if(component&&(!known(component.version)||!known(String(component.productDetails.instance||''))))add('SQL_BASELINE',use,'editionHaEvidence','Record the exact SQL release/build and instance scope on the SQL component.')
      if(value(use,'workloadScope')!=='supporting')add('SQL_MIXED',use,'workloadScope','Mixed or unrelated workloads do not receive included supporting-technology credit.')
      for(const child of children){
        const consumer=project.components.find(c=>c.id===value(child,'consumer')),purpose=value(child,'purpose')
        if(!consumer||!(consumer.product==='vmm'&&purpose==='vmm'||consumer.product==='scom'&&['operational','warehouse','acs','reporting'].includes(purpose)))add('SQL_WORKLOAD_RIGHTS',child,'purpose','Included SQL must map a matching VMM or SCOM database/reporting workload. Review other workloads under separate SQL rights.')
        if(consumer&&!services.some(s=>value(s,'component')===consumer.id&&value(s,'license')===value(use,'supportingLicense')))add('SQL_ESTATE_LINK',child,'consumer','Link the consuming VMM/SCOM service to this same supporting System Center estate.')
      }
    }else if(item&&value(item,'rights')==='included'&&!(value(use,'mode')==='provider'&&value(item,'commercialProgram')==='provider'&&value(item,'entitlementTerm')==='provider'))add('SQL_MODE',use,'mode','A separate SQL license cannot inherit supporting-technology credit. Provider inclusion needs an explicit provider program and entitlement term.')
    if(value(use,'mode')==='provider'&&item&&(!known(value(item,'providerRightsEvidence'))||value(item,'context')!=='hosted'))add('SQL_PROVIDER',use,'hostingEvidence','Provider SQL needs a hosted item with explicit provider/customer rights evidence.')
  }
  for(const item of licenses.filter(l=>value(l,'product')==='sql'))if(!uses.some(u=>value(u,'license')===item.id))add('SQL_SCOPE_MISSING',item,'coverage','Map the SQL OSE, edition and workload scope before reviewing this license item. Included System Center SQL also requires its supporting estate.',[item.id])
  for(const child of workloads)if(workloads.some(w=>w.id!==child.id&&value(w,'use')===value(child,'use')&&normalized(value(w,'name'))===normalized(value(child,'name'))))add('SQL_DATABASE_DUPLICATE',child,'name','This database/reporting workload is already mapped in the SQL scope.')
  const targets=referenceOptions(project,'$licenseTargets'),mappedIds=new Set([...mapped.map(r=>r.targetId),...assignments.map(a=>value(a,value(a,'kind')==='host'?'host':'vm'))])
  const unmapped=targets.filter(r=>!mappedIds.has(r.id))
  if(unmapped.length)findings.push({code:'LICENSE_COVERAGE_UNMAPPED',section:'licensing',severity:'warning',message:`${unmapped.length} resources have no explicit licensing coverage mapping. Listed-item price totals are not a complete estate budget.`,licenseIds:[]})
  return {kind:'hyperv-license-coverage',schemaVersion:1,projectId:project.id,projectRevision:project.revision,sources:LICENSE_COVERAGE_SOURCES,objects,mapped,unmapped,dependencies,baseAccessDependencies:dependencyPlan.baseAccessDependencies,findings,addsLicenseQuantity:false}
}
