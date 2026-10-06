import {visibleField,type DesignRecord} from './catalog'
import type {Project} from './project'
import type {CoverageFinding} from './licenseCoverage'
import {licenseDependencyCollections} from './licenseDependencyFields'
import {referenceOptions} from './references'
const value=(r:DesignRecord|undefined,k:string)=>String(r?.values[k]??'').trim()
const known=(s:string)=>!!s&&!/^withheld for sharing|^secret-ref:\/\/withheld\//i.test(s)
const norm=(s:string)=>s.toLowerCase().trim()
export function licenseDependencyPlan(project:Project){
  const findings:CoverageFinding[]=[],access=project.design.accessRights,meters=project.design.azureLicenseMeters,links=project.design.licenseDependencies
  const item=(r:DesignRecord)=>project.design.licenses.find(l=>l.id===value(r,'license'))
  const add=(code:string,row:DesignRecord,key:string,message:string,ids=[value(row,'license')])=>findings.push({code:`LICENSE_DEPENDENCY_${code}`,section:'licensing',recordId:row.id,fieldKey:key,severity:'error',message:`${value(row,'name')||'Licensing dependency'}: ${message}`,licenseIds:ids.filter(Boolean)})
  const objects=Object.fromEntries(licenseDependencyCollections.map(c=>[c.key,project.design[c.key].map(row=>{
    const fields=c.fields.filter(f=>visibleField(f,row.values))
    for(const f of fields){
      const v=value(row,f.key)
      if(f.required&&!known(v))add('REQUIRED',row,f.key,`Record ${f.label.toLowerCase()}.`)
      if(f.collection&&v&&!referenceOptions(project,f.collection).some(r=>r.id===v))add('REFERENCE',row,f.key,`${f.label} must identify an active matching record.`)
      if(f.type==='number'&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e9))add('NUMBER',row,f.key,`${f.label} must be a finite non-negative value within the supported range.`)
    }
    return {id:row.id,values:Object.fromEntries(fields.map(f=>[f.key,row.values[f.key]]))}
  }).sort((a,b)=>a.id.localeCompare(b.id))]))
  for(const row of access){
    const license=item(row),q=Number(row.values.quantity),kind=value(row,'kind')
    if(license&&(value(license,'product')!=='access'||value(license,'calculationModel')!=='manual'))add('ACCESS_ITEM',row,'license','Select a reviewed manual access-rights license item.')
    if(!Number.isSafeInteger(q)||q<0)add('ACCESS_COUNT',row,'quantity','Access units require a whole non-negative reviewed count.')
    if(license&&q!==Number(license.values.required))add('ACCESS_QUANTITY',row,'quantity','Audience units must match the license item required units; use one quoted unit per counted user, device or server.')
    if(access.some(r=>r.id!==row.id&&value(r,'license')===value(row,'license')))add('ACCESS_ITEM_DUPLICATE',row,'license','Consolidate this item into one complete audience allocation.')
    const duplicates=access.filter(r=>r.id!==row.id&&value(r,'kind')===kind&&value(r,'metric')===value(row,'metric')&&norm(value(r,'audience'))===norm(value(row,'audience'))&&norm(value(item(r),'customerScope'))===norm(value(license,'customerScope')))
    if(duplicates.length)add('ACCESS_OVERLAP',row,'audience','This audience already has the same access-right allocation. Consolidate coverage before adding another charge.',[value(row,'license'),...duplicates.map(r=>value(r,'license'))])
    if(kind==='sal'&&license&&(value(license,'context')!=='hosted'||!(['provider','spla'].includes(value(license,'commercialProgram')))||!(['provider','subscription'].includes(value(license,'entitlementTerm')))||!known(value(license,'providerRightsEvidence'))))add('SAL_PROGRAM',row,'kind','SAL scope requires the exact SPLA/provider program, applicable term and hosted-service rights review.')
    if(kind==='sal'&&!['user','device'].includes(value(row,'metric')))add('SAL_METRIC',row,'metric','Subscriber access scope counts unique authorized users or devices; review other rights under a separate access kind.')
    if(kind==='sal'&&license&&value(license,'commercialProgram')==='spla'&&value(license,'entitlementTerm')!=='subscription')add('SAL_TERM',row,'kind','SPLA subscriber access requires the reviewed subscription term.')
    if(kind==='rds'){
      const base=project.design.licenses.find(l=>l.id===value(row,'baseLicense')),scope=access.find(a=>value(a,'license')===base?.id&&value(a,'kind')==='windows')
      if(!base||!scope||base.id===license?.id)add('RDS_BASE',row,'baseLicense','RDS additive rights need a separately reviewed Windows base access item and audience scope.')
      else if(norm(value(base,'customerScope'))!==norm(value(license,'customerScope'))||value(scope,'metric')!==value(row,'metric')||norm(value(scope,'audience'))!==norm(value(row,'audience'))||Number(scope.values.quantity)<q)add('RDS_AUDIENCE',row,'baseLicense','The base access item must cover this customer, counting unit and audience with at least the RDS count. Review alternative or mixed allocations separately.')
    }
  }
  for(const row of meters){
    const license=item(row),q=Number(row.values.quantity)
    if(license&&(value(license,'product')!=='azure'||value(license,'calculationModel')!=='manual'))add('AZURE_ITEM',row,'license','Select a reviewed manual Azure service item.')
    if(license&&(q!==Number(license.values.required)||value(row,'unit')!==value(license,'basis')||value(row,'period')!==value(license,'term')))add('AZURE_BASIS',row,'quantity','Meter quantity, exact unit and charge period must match the quoted item; no implicit period or unit conversion is applied.')
    if(meters.some(r=>r.id!==row.id&&value(r,'license')===value(row,'license')))add('AZURE_ITEM_DUPLICATE',row,'license','Use one complete meter scope per quoted item.')
    const duplicate=meters.filter(r=>r.id!==row.id&&['scope','meter','region','period'].every(k=>norm(value(r,k))===norm(value(row,k)))&&norm(value(item(r),'customerScope'))===norm(value(license,'customerScope')))
    if(duplicate.length)add('AZURE_DUPLICATE',row,'meter','This billing scope, meter, region and period is already costed; consolidate overlapping estimates.',[value(row,'license'),...duplicate.map(r=>value(r,'license'))])
    if(license){
      const benefit=value(row,'benefit'),owned=Number(license.values.owned),included=value(license,'rights')==='included'
      if(benefit==='none'&&(owned>0||included)||benefit==='allocation'&&(owned<=0||included)||benefit==='included'&&(!included||owned>0))add('AZURE_BENEFIT',row,'benefit','Benefit selection must match allocated units or explicit full inclusion on the license item. Unknown benefits grant no credit.')
      if(owned>0&&meters.some(r=>r.id!==row.id&&norm(value(item(r),'entitlementId'))===norm(value(license,'entitlementId'))&&!['meter','region','period','unit'].every(k=>norm(value(r,k))===norm(value(row,k)))))add('AZURE_POOL',row,'benefit','One covered-unit pool must retain the same meter, region, charge period and unit. Review cross-meter monetary credits separately instead of treating them as interchangeable units.')
    }
    if(!Number.isSafeInteger(Number(row.values.retentionDays)))add('RETENTION',row,'retentionDays','Retention days require a whole non-negative count.')
  }
  for(const row of links){
    const license=item(row),category=value(row,'category'),target=value(row,'target')
    const expected:Record<string,string[]>={ome:['ome'],vmware:['vmware'],backup:['backup'],sdn:['windows','other'],other:['other','vmware','backup','ome']}
    if(license&&!expected[category]?.includes(value(license,'product')))add('PRODUCT',row,'license','The license product must match this dependency category; host/guest Windows OS coverage is separate from appliance/plugin coverage.')
    if(category==='ome'&&!project.components.some(c=>c.id===target&&c.product==='ome'))add('OME_TARGET',row,'target','Select the OME appliance using this feature; record its covered device inventory in the allocation evidence.')
    if(category==='sdn'&&license&&value(license,'product')==='windows'){
      const direct=project.design.licenseAssignments.some(a=>value(a,'license')===license.id&&(value(a,'host')===target||value(a,'vm')===target))
      const mapped=project.design.licenseCoverage.some(c=>value(c,'license')===license.id&&value(c,'target')===target)
      if(!direct&&!mapped)add('SDN_OS_SCOPE',row,'target','Link this SDN host/VM to the Windows assignment or resource coverage; a dependency note does not grant OS rights.')
    }
    const duplicates=links.filter(r=>r.id!==row.id&&value(r,'category')===category&&value(r,'target')===target&&norm(value(r,'feature'))===norm(value(row,'feature')))
    if(duplicates.length)add('FEATURE_DUPLICATE',row,'feature','This feature on this resource is already covered; reuse one entitlement and avoid another charge.',[value(row,'license'),...duplicates.map(r=>value(r,'license'))])
  }
  for(const license of project.design.licenses){
    const product=value(license,'product'),rows=product==='access'?access:product==='azure'?meters:['ome','vmware','backup','other'].includes(product)?links:undefined
    if(rows&&!rows.some(r=>value(r,'license')===license.id))add('SCOPE_MISSING',license,'coverage','Map this item to its access audience, Azure meter or feature dependency before crediting coverage.',[license.id])
  }
  return {objects,findings,baseAccessDependencies:access.filter(r=>value(r,'kind')==='rds').map(r=>({licenseId:value(r,'license'),sourceLicenseId:value(r,'baseLicense'),recordId:r.id})),addsLicenseQuantity:false}
}
