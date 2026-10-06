import type {Project} from './project'
import type {Finding} from './validation'
import {CORE_LICENSE_RULES,physicalCoreRequirement,virtualCoreRequirement,type PhysicalCoreInputs} from './licenseModel'
import {referenceOptions} from './references'
import {licensingRightsReview} from './licensingRights'
import {licenseCoveragePlan} from './licenseCoverage'

const whole=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=1e9
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const round=(n:number)=>Number(n.toFixed(6))
const metered=(n:number)=>Number.isFinite(n)&&n>=0&&n<=1e9&&round(n)===n
type Issue=Finding&{domain:'quantity'|'rights'|'price'}

export function licensingPlan(project:Project) {
  const asOf=new Date(project.updatedAt).toISOString().slice(0,10),coverage=licenseCoveragePlan(project),findings:Finding[]=[...coverage.findings]
  const assignments=project.design.licenseAssignments
  const vmOptions=referenceOptions(project,'$licenseVMs')
  for(const assignment of assignments)if(!project.design.licenses.some(l=>l.id===assignment.values.license))findings.push({code:'LICENSE_ASSIGNMENT_ITEM',section:'licensing',recordId:assignment.id,fieldKey:'license',severity:'error',message:`${assignment.values.name}: select an existing license item.`})
  const rows=[...project.design.licenses].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
    const v=row.values,s=(key:string)=>String(v[key]??'').trim(),model=s('calculationModel'),issues:Issue[]=[]
    const add=(key:string,message:string,domain:Issue['domain']='quantity',recordId=row.id)=>issues.push({code:`LICENSE_${key.toUpperCase()}`,section:'licensing',recordId,fieldKey:key,severity:'error',domain,message:`${s('name')||'License item'}: ${message}`})
    const assigned=assignments.filter(a=>a.values.license===row.id)
    const units=s('product')==='azure'?metered:whole
    let required:number|null=Number(v.required),coreLicenses:number|null=null
    const details:Record<string,unknown>[]=[]
    if(!['manual','physical','virtual'].includes(model))add('calculationModel','Choose a quantity calculation model.')
    if(model==='manual') {
      if(!units(Number(v.required)))add('required',s('product')==='azure'?'Enter a non-negative reviewed meter quantity with at most six decimal places.':'Enter a whole, non-negative reviewed quantity.')
      if(assigned.length)add('calculationModel','Manual quantities do not consume structured assignments; select a calculated model or remove those assignments.')
    } else {
      if(!['windows','systemcenter'].includes(s('product')))add('product','Calculated core models apply only to Windows Server and System Center server licensing.')
      if(s('ruleProfile')!=='commercial2025')add('ruleProfile','Select the reviewed Commercial Licensing 2025 rule profile.')
      if(!['standard','datacenter'].includes(s('coreEdition')))add('coreEdition','Choose the core license edition independently of the installed host edition.')
      if(!['core','pack2','pack16'].includes(s('unitBasis')))add('unitBasis','Record the quoted core-license unit size; the free-text SKU does not determine pack size.')
      if(!s('customerScope'))add('customerScope','Record the customer and assignment boundary.')
      if(s('context')==='hosted'||/\b(spla|oem)\b/i.test(s('program')))add('context','SPLA/OEM and hosted/outsourcing rights need a separately reviewed model; use a reviewed manual quantity for this commercial context.','rights')
      if(s('rights')==='included')add('rights','Core quantities do not determine included rights. Use a reviewed manual item for a separately evidenced inclusion.','rights')
      if(!assigned.length)add('calculationModel','Add explicit host or server-VM assignments.')
      const vmInputs:{vCores:number;count:number}[]=[]
      let physicalCores=0
      for(const assignment of assigned) {
        const a=assignment.values,targetId=String(model==='physical'?a.host:a.vm),targetKind=model==='physical'?'host':'vm'
        const aadd=(key:string,message:string)=>add(key,message,'quantity',assignment.id)
        if(a.kind!==targetKind)aadd('kind',`Assignment ${a.name} must select ${targetKind==='host'?'a physical server':'a server VM'} for this calculation.`)
        if(!String(a.placementReview).trim()||!String(a.owner).trim())aadd('placementReview',`Assignment ${a.name} needs an owner and normal/maintenance/failover evidence, including an explicit review of any zero OSE count.`)
        const other=assignments.find(other=>{
          if(other.id===assignment.id||other.values.kind!==targetKind||String(targetKind==='host'?other.values.host:other.values.vm)!==targetId)return false
          const otherLicense=project.design.licenses.find(l=>l.id===other.values.license)
          return otherLicense?.values.product===v.product&&otherLicense.values.calculationModel===model
        })
        if(other)aadd(targetKind==='host'?'host':'vm',`${targetId||'Missing target'} is assigned more than once for the same product/model. Consolidate the reviewed quantity so demand is not counted twice.`)
        if(model==='physical') {
          const host=[...project.design.hosts,...project.design.licenseServers].find(h=>h.id===targetId)
          const calculation=host?physicalCoreRequirement({sockets:Number(host.values.sockets),coresPerSocket:Number(host.values.coresPerSocket),edition:s('coreEdition') as PhysicalCoreInputs['edition'],peakVirtualOSEs:Number(a.peakVirtualOSEs),physicalOSE:String(a.physicalOSE) as PhysicalCoreInputs['physicalOSE']}):null
          if(!host)aadd('host','Select an explicit physical host inventory record.')
          if(host&&!calculation)aadd('physicalOSE','Review positive whole socket/core inventory, whole peak OSE counts and physical OSE use.')
          if(calculation)physicalCores+=calculation.coreLicenses
          details.push({assignmentId:assignment.id,targetId,name:host?.values.name||targetId,kind:'host',peakVirtualOSEs:a.peakVirtualOSEs,physicalOSE:a.physicalOSE,calculation,placementReview:a.placementReview})
        } else {
          const component=project.components.find(c=>c.id===targetId),resource=[...project.design.workloads,...(project.sdn.scope==='none'?[]:project.design.sdnResources)].find(r=>r.id===targetId)
          const cores=component?.vCpu??Number(resource?.values.vCpu)
          if(!vmOptions.some(o=>o.id===targetId))aadd('vm','Select a hosted server VM; external services, physical components and OME appliances are outside this VM model.')
          if(!whole(cores)||cores<1)aadd('vm','The selected VM needs a positive whole vCPU count in its resource record.')
          if(!['windows','other'].includes(String(a.osClass))||(s('product')==='windows'&&a.osClass!=='windows'))aadd('osClass','Confirm the server OS class; a Windows Server item requires Windows Server guests.')
          vmInputs.push({vCores:cores,count:1})
          details.push({assignmentId:assignment.id,targetId,name:component?.name||resource?.values.name||targetId,kind:'vm',vCores:cores,osClass:a.osClass,placementReview:a.placementReview})
        }
      }
      if(model==='virtual') {
        const eligible=['sa','subscription'].includes(s('vmEligibility'))&&date(s('saExpiry'))&&s('saExpiry')>=asOf
        if(!eligible)add('vmEligibility','Per-VM licensing needs an eligible subscription or active SA with a valid expiry date covering this design date.','rights')
        if(!s('customerMinimumReview'))add('customerMinimumReview','Review the complete customer/product core-license pool before applying its 16-core minimum.')
        if(project.design.licenses.some(l=>l.id!==row.id&&l.values.calculationModel==='virtual'&&l.values.product===v.product&&String(l.values.customerScope).trim().toLowerCase()===s('customerScope').toLowerCase()))add('customerScope','Use one reviewed per-VM pool per customer/product so its minimum is not counted repeatedly. Mixed agreements/editions or external entitlement pools require a manual review.')
        const calculation=virtualCoreRequirement(vmInputs,eligible)
        if(!calculation)add('calculationModel','Per-VM core quantities remain unknown until the scoped VM inventory and licensing eligibility are complete.')
        coreLicenses=calculation?.coreLicenses??null
        if(calculation)details.push({kind:'customer-minimum',vmCoreLicenses:calculation.vmCoreLicenses,minimumTopUp:calculation.customerMinimumTopUp})
      } else coreLicenses=physicalCores
      if(coreLicenses!==null&&!Number.isSafeInteger(coreLicenses))add('calculationModel','The core quantity exceeds the supported exact numeric range.')
      const divisor=({core:1,pack2:2,pack16:16} as Record<string,number>)[s('unitBasis')]
      required=coreLicenses!==null&&divisor?Math.ceil(coreLicenses/divisor):null
    }
    if(!s('owner')||!s('program')||!s('basis')||!s('customerScope')||!['internal','customer','hosted'].includes(s('context')))add('program','Record the licensing owner, customer boundary, commercial context, agreement and SKU/basis.','rights')
    if(!s('assignmentReview')||!date(s('reviewedAt'))||s('reviewedAt')>asOf)add('assignmentReview','Record quantity/entitlement assignment evidence and a valid review date no later than this design date.','rights')
    if(!['existing','purchase','included'].includes(s('rights')))add('rights','Resolve the coverage source.','rights')
    if(s('rights')==='included'&&!s('restrictedUse'))add('restrictedUse','Document the exact included-use eligibility and exclusions before crediting it.','rights')
    const covered=Number(v.owned)
    if(!units(covered)||!units(Number(v.entitlementTotalUnits)))add('owned',s('product')==='azure'?'Covered meter units require non-negative quantities with at most six decimal places.':'Entitlement quantities must be whole non-negative units.','rights')
    if(covered>0) {
      if(!s('entitlementId'))add('entitlementId','Identify the existing entitlement pool before crediting covered units.','rights')
      const pool=project.design.licenses.filter(l=>String(l.values.entitlementId).trim().toLowerCase()===s('entitlementId').toLowerCase())
      if(pool.some(l=>Number(l.values.entitlementTotalUnits)!==Number(v.entitlementTotalUnits)||l.values.product!==v.product||l.values.unitBasis!==v.unitBasis||l.values.coreEdition!==v.coreEdition||l.values.program!==v.program||l.values.customerScope!==v.customerScope||l.values.edition!==v.edition||l.values.basis!==v.basis))add('entitlementId','The same entitlement pool must retain its total, product, edition, agreement, customer and unit basis.','rights')
      if(round(pool.reduce((n,l)=>n+Number(l.values.owned),0))>Number(v.entitlementTotalUnits))add('owned','Assigned covered units exceed the entitlement pool total; do not credit the same units twice.','rights')
    }
    const price=Number(v.unitPrice)
    if(!['quoted','nocharge'].includes(s('quoteStatus'))||!s('quoteSource')||!date(s('quoteDate'))||s('quoteDate')>asOf)add('quoteStatus','Record a dated quote or confirmed no-charge evidence; an unfilled price is not a free license.','price')
    if(!Number.isFinite(price)||price<0||(s('quoteStatus')==='quoted'&&price<=0)||(s('quoteStatus')==='nocharge'&&price!==0))add('unitPrice','A priced quote needs a positive price; confirmed no-charge needs an explicit zero.','price')
    if(!/^[A-Z]{3}$/.test(s('currency'))||!['perpetual','monthly','annual'].includes(s('term')))add('currency','Record the quote currency code and charge period.','price')
    const quantityResolved=!issues.some(i=>i.domain==='quantity')&&required!==null
    const commercial=licensingRightsReview(v,row.id,asOf)
    findings.push(...commercial.findings)
    const coverageIssues=coverage.findings.filter(f=>f.severity==='error'&&f.licenseIds.includes(row.id))
    const rightsResolved=!issues.some(i=>i.domain==='rights')&&commercial.rightsResolved&&!coverageIssues.length
    const purchaseUnits=quantityResolved&&rightsResolved?(s('rights')==='included'?0:round(Math.max(0,Number(required)-covered))):null
    const cost=purchaseUnits===null?null:round(purchaseUnits*price)
    if(cost!==null&&(!Number.isFinite(cost)||cost>Number.MAX_SAFE_INTEGER))add('unitPrice','The estimate exceeds the supported numeric range.','price')
    const priceResolved=!issues.some(i=>i.domain==='price')
    findings.push(...issues.map(({domain:_domain,...finding})=>finding))
    return {id:row.id,name:s('name'),product:s('product'),calculationModel:model,unitBasis:model==='manual'?s('basis'):s('unitBasis'),customerScope:s('customerScope'),currency:s('currency')||'Unspecified',term:s('term')||'Unspecified',asOf,quoteDate:s('quoteDate'),quoteSource:s('quoteSource'),coreLicenses:quantityResolved?coreLicenses:null,required:quantityResolved?Number(required):null,covered,purchaseUnits,estimatedCost:quantityResolved&&rightsResolved&&priceResolved?cost:null,quantityResolved,rightsResolved,priceResolved,commercial,unresolved:!quantityResolved||!rightsResolved,details,reasons:[...issues.map(i=>i.message),...commercial.findings.map(i=>i.message),...coverageIssues.map(i=>i.message)]}
  })
  for(const dependency of coverage.dependencies){
    const source=rows.find(r=>r.id===dependency.sourceLicenseId),item=rows.find(r=>r.id===dependency.licenseId)
    if(item&&(!source||source.product!=='systemcenter'||!source.quantityResolved||!source.rightsResolved||source.required===null||source.required<1)){
      const message=`${item.name}: included SQL remains unresolved until the supporting System Center estate has a positive, reviewed quantity and valid rights.`
      findings.push({code:'LICENSE_SQL_SUPPORTING_ESTATE',section:'licensing',recordId:dependency.recordId,fieldKey:'supportingLicense',severity:'error',message})
      item.rightsResolved=false;item.unresolved=true;item.purchaseUnits=null;item.estimatedCost=null;item.reasons.push(message)
    }
  }
  for(const dependency of coverage.baseAccessDependencies){
    const source=rows.find(r=>r.id===dependency.sourceLicenseId),item=rows.find(r=>r.id===dependency.licenseId)
    if(item&&(!source||!source.quantityResolved||!source.rightsResolved||source.required===null||source.required<(item.required??0))){
      const message=`${item.name}: additive access rights remain unresolved until the base access audience has reviewed quantities and rights.`
      findings.push({code:'LICENSE_ACCESS_BASE',section:'licensing',recordId:dependency.recordId,fieldKey:'baseLicense',severity:'error',message})
      item.rightsResolved=false;item.unresolved=true;item.purchaseUnits=null;item.estimatedCost=null;item.reasons.push(message)
    }
  }
  const totals=[...new Set(rows.map(r=>`${r.currency}|${r.term}`))].sort().map(key=>{
    const items=rows.filter(r=>`${r.currency}|${r.term}`===key),known=items.filter(r=>r.estimatedCost!==null)
    const amount=known.reduce((n,r)=>n+r.estimatedCost!,0),inRange=Number.isFinite(amount)&&amount<=Number.MAX_SAFE_INTEGER
    if(!inRange)findings.push({code:'LICENSE_TOTAL_RANGE',section:'licensing',severity:'error',message:`${items[0].currency} / ${items[0].term}: the total exceeds the supported numeric range.`})
    return {currency:items[0].currency,term:items[0].term,knownEstimate:inRange?round(amount):null,complete:inRange&&known.length===items.length,quotedItems:known.length,unresolvedItems:items.length-known.length,...(inRange?{}:{rangeReview:true})}
  })
  return {kind:'hyperv-licensing-assessment',schemaVersion:1,projectId:project.id,projectRevision:project.revision,asOf,coverage,rules:CORE_LICENSE_RULES,rows,totals,findings,assumptions:['Core quantities are reviewed planning estimates, not an entitlement certification.','Physical assignments use each host’s maximum OSE placement, including reserve/failover destinations; reserve hosts are not subtracted.','Per-VM quantities apply a separate 8-core VM minimum and a 16-core customer/product pool minimum; eligibility and complete pool scope require review.','Owned units are allocated from named entitlement pools before purchase gaps are calculated. Different products, customers, currencies and charge periods are not combined.','Quote estimates retain up to six decimal places; invoice, tax, discount and currency rounding require the actual commercial quote.']}
}

export function licenseSummary(project:Project) {return licensingPlan(project).rows}
export const licenseUnitLabel=(value:string)=>({core:'Core license',pack2:'Two-core pack',pack16:'Sixteen-core pack'} as Record<string,string>)[value]||value

export function licenseAssignmentSchedule(project:Project) {
  return licensingPlan(project).rows.flatMap(row=>row.details.map(d=>{
    const c=d.calculation as ReturnType<typeof physicalCoreRequirement>|undefined
    return {LicenseItem:row.name,LicenseId:row.id,AssignmentId:d.assignmentId||'',TargetId:d.targetId||row.customerScope,TargetName:d.name||row.customerScope,Model:d.kind,PhysicalCores:c?.physicalCores??null,BaseCores:c?.baseCores??null,LicenseSets:c?.sets??null,CoreLicenses:c?.coreLicenses??null,VirtualCores:d.vCores??null,PeakVirtualOSEs:d.peakVirtualOSEs??null,CustomerMinimumTopUp:d.minimumTopUp??null,PlacementReview:d.placementReview||''}
  }))
}
