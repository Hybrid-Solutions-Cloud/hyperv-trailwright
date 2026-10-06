import {describe,it,expect} from 'vitest'
import {licenseCoverageFixture} from './testing/licenseCoverageFixture'
import {licenseCoveragePlan} from './licenseCoverage'
import {licensingPlan} from './licensing'
import {newComponent,parseProject,serializeProject,componentTotals} from './project'
import {removeLicenseCoverageV29} from './testing/legacyLicenseCoverage'
import {sanitizeProject} from './sanitize'
import {environmentFiles} from './exports'
import {referenceOptions} from './references'
import {sdnServicesFixture} from './testing/sdnServicesFixture'
import {sdnEvidenceTemplate,importSdnEvidence,sdnEvidenceAssessment} from './sdnEvidence'
import {removeLicensingRightsV28} from './testing/legacyLicensingRights'
const row=(p:ReturnType<typeof licenseCoverageFixture>['project'],id:string)=>licensingPlan(p).rows.find(r=>r.id===id)!

describe('resource, managed estate and supporting SQL licensing',()=>{
  it('shares one System Center estate between VMM and SCOM and grants no extra quantity from links',()=>{
    const {project,sc,sqlLicense}=licenseCoverageFixture(),plan=licensingPlan(project)
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
    expect(plan.rows.find(r=>r.id===sc.id)).toMatchObject({coreLicenses:48,required:24,estimatedCost:480})
    expect(plan.rows.find(r=>r.id===sqlLicense.id)).toMatchObject({required:1,purchaseUnits:0,estimatedCost:0,rightsResolved:true})
    expect(plan.coverage.addsLicenseQuantity).toBe(false)
    project.design.systemCenterConsumers.pop()
    expect(row(project,sc.id).coreLicenses).toBe(48)
    expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
  })
  it('calculates a dedicated physical management server without adding virtual infrastructure demand',()=>{
    const {project,vm,license,add}=licenseCoverageFixture();project.design.licenseCoverage=[];vm.hosting='physical'
    const before=componentTotals(project)
    const server=add('licenseServers','external-server',{provider:'physical',nativeId:'EXAMPLE physical identity',providerScope:'EXAMPLE provider',component:vm.id,sockets:1,coresPerSocket:6,inventoryEvidence:'EXAMPLE physical hardware review'})
    add('licenseAssignments','external-assignment',{license:license.id,kind:'host',host:server.id,peakVirtualOSEs:0,physicalOSE:'other',placementReview:'EXAMPLE dedicated management OSE'})
    add('licenseCoverage','physical-management',{license:license.id,target:vm.id,basis:'assignment',assignment:'external-assignment',scenario:'all',osClass:'windows',evidence:'EXAMPLE physical management OS rights'})
    expect(componentTotals(project)).toEqual(before)
    expect(row(project,license.id)).toMatchObject({coreLicenses:64,required:32,purchaseUnits:24,estimatedCost:240})
    expect(referenceOptions(project,'$licensePhysicalServers').some(r=>r.id===server.id)).toBe(true)
    server.values.sockets=0;expect(row(project,license.id).required).toBeNull()
  })
  it('rejects duplicate physical inventory identities and links to nonphysical components',()=>{
    const {project,vm,add}=licenseCoverageFixture()
    const server=add('licenseServers','external-server',{provider:'physical',nativeId:'EXAMPLE physical',providerScope:'EXAMPLE boundary',component:vm.id,sockets:2,coresPerSocket:8,inventoryEvidence:'EXAMPLE inventory'})
    add('licenseServers','duplicate',{...server.values})
    expect(licenseCoveragePlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['LICENSE_COVERAGE_SERVER_DUPLICATE','LICENSE_COVERAGE_SERVER_COMPONENT']))
  })
  it('allows different physical failover destinations but blocks overlapping claims and understated peak OSEs',()=>{
    const {project,mapping,add,license,sql}=licenseCoverageFixture()
    expect(row(project,license.id).rightsResolved).toBe(true)
    const duplicate=add('licenseCoverage','duplicate',{...mapping.values,scenario:'all'})
    expect(row(project,license.id).purchaseUnits).toBeNull()
    project.design.licenseCoverage=project.design.licenseCoverage.filter(r=>r.id!==duplicate.id)
    add('licenseCoverage','sql-too-many',{...mapping.values,target:sql.id})
    expect(licenseCoveragePlan(project).findings.some(f=>f.code==='LICENSE_COVERAGE_PEAK_OSES')).toBe(true)
  })
  it('rejects a foreign assignment, invalid OS coverage and external services masquerading as VMs',()=>{
    const {project,mapping,vm}=licenseCoverageFixture()
    mapping.values.assignment='sc-assignment-a';mapping.values.osClass='appliance';vm.hosting='external'
    expect(licenseCoveragePlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['LICENSE_COVERAGE_ASSIGNMENT_ITEM','LICENSE_COVERAGE_WINDOWS_OS','LICENSE_COVERAGE_EXTERNAL_TARGET']))
  })
  it('blocks mixed, unrelated, Enterprise and unsupported full-AG claims under included SQL',()=>{
    const {project,use,sql,sqlLicense,database,add}=licenseCoverageFixture()
    use.values.workloadScope='mixed';expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
    use.values.workloadScope='supporting';database.values.purpose='other';expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
    database.values.purpose='vmm';sql.productDetails.edition='enterprise';expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
    sql.productDetails.edition='standard';add('availabilityGroups','sql-ag',{product:'sql',strategy:'sqlag',sqlAgKind:'full'});add('availabilityMembers','sql-member',{group:'sql-ag',component:sql.id})
    expect(licenseCoveragePlan(project).findings.some(f=>f.code==='LICENSE_COVERAGE_SQL_ENTERPRISE_FEATURE')).toBe(true)
  })
  it('allows separate SQL purchase review and retains inactive included-source choices in the project',()=>{
    const {project,use,sqlLicense,sql}=licenseCoverageFixture()
    use.values.mode='separate';use.values.workloadScope='mixed';sql.productDetails.edition='enterprise';Object.assign(sqlLicense.values,{rights:'purchase',unitPrice:100,quoteStatus:'quoted'})
    expect(row(project,sqlLicense.id)).toMatchObject({purchaseUnits:1,estimatedCost:100})
    expect(licenseCoveragePlan(project).objects.sqlLicenseUses[0].values).not.toHaveProperty('supportingLicense')
    expect(use.values.supportingLicense).toBe('sc-estate')
  })
  it('requires the supporting estate quantity/rights, but keeps quote uncertainty separate',()=>{
    const {project,sc,sqlLicense}=licenseCoverageFixture()
    sc.values.quoteStatus='review';expect(row(project,sqlLicense.id).estimatedCost).toBe(0)
    sc.values.rightsEvidence='';expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
    sc.values.rightsEvidence='EXAMPLE rights';project.design.licenseAssignments=project.design.licenseAssignments.filter(a=>a.values.license!==sc.id)
    expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
  })
  it('keeps provider-included SQL separate from System Center supporting technology',()=>{
    const {project,use,sqlLicense,sql}=licenseCoverageFixture();use.values.mode='provider';use.values.workloadScope='general';sql.productDetails.edition='enterprise'
    expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
    Object.assign(sqlLicense.values,{context:'hosted',commercialProgram:'provider',entitlementTerm:'provider',reassignmentBasis:'provider',providerRightsEvidence:'EXAMPLE provider contract explicitly includes this SQL OSE',restrictedUse:'EXAMPLE provider inclusion scope and exclusions'})
    expect(row(project,sqlLicense.id)).toMatchObject({purchaseUnits:0,estimatedCost:0,rightsResolved:true})
    expect(licenseCoveragePlan(project).dependencies).toEqual([])
    sqlLicense.values.providerRightsEvidence='';expect(row(project,sqlLicense.id).purchaseUnits).toBeNull()
  })
  it('blocks duplicate SQL OSE claims, missing workloads, customer changes and mismatched product links',()=>{
    const {project,use,sqlLicense,add}=licenseCoverageFixture()
    add('sqlLicenseUses','duplicate',{...use.values});expect(row(project,sqlLicense.id).rightsResolved).toBe(false)
    project.design.sqlLicenseUses.pop();project.design.sqlWorkloads=[];expect(row(project,sqlLicense.id).rightsResolved).toBe(false)
    sqlLicense.values.customerScope='Different customer';use.values.supportingLicense='license-a'
    expect(licenseCoveragePlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['LICENSE_COVERAGE_SQL_CUSTOMER','LICENSE_COVERAGE_SQL_SOURCE']))
  })
  it('does not price an extra SQL item until its OSE scope is mapped and checked for duplicate charges',()=>{
    const {project,use,sqlLicense,add}=licenseCoverageFixture()
    const extra=add('licenses','extra-sql',{...sqlLicense.values,name:'EXAMPLE separate SQL quote',rights:'purchase',quoteStatus:'quoted',unitPrice:100})
    expect(row(project,extra.id)).toMatchObject({required:1,purchaseUnits:null,estimatedCost:null})
    add('sqlLicenseUses','extra-scope',{...use.values,license:extra.id,mode:'separate'})
    expect(row(project,extra.id).estimatedCost).toBeNull();expect(row(project,sqlLicense.id).estimatedCost).toBeNull()
    expect(licenseCoveragePlan(project).findings.some(f=>f.code==='LICENSE_COVERAGE_SQL_DUPLICATE')).toBe(true)
  })
  it('requires explicit provider evidence and preserves unmapped-resource review',()=>{
    const {project,add,license}=licenseCoverageFixture(),external=newComponent('admin');external.id='external-admin';external.hosting='external';project.components.push(external)
    expect(licenseCoveragePlan(project).unmapped.some(r=>r.id===external.id)).toBe(true)
    const provider=add('licenses','provider',{...license.values,name:'EXAMPLE provider OS',calculationModel:'manual',context:'hosted',required:1,owned:0,entitlementTotalUnits:0,entitlementId:'',commercialProgram:'provider',entitlementTerm:'provider',reassignmentBasis:'provider'})
    add('licenseCoverage','provider-cover',{license:provider.id,target:external.id,basis:'provider',scenario:'all',osClass:'windows',evidence:'EXAMPLE external Windows responsibility'})
    expect(row(project,provider.id).rightsResolved).toBe(false)
    provider.values.providerRightsEvidence='EXAMPLE provider/customer rights';expect(row(project,provider.id).rightsResolved).toBe(true)
  })
  it('migrates schema28 without invented coverage and preserves all preceding SDN/licensing records',()=>{
    const {project,sqlLicense}=licenseCoverageFixture(),old:any=structuredClone(project);old.schemaVersion=28
    expect(()=>parseProject(JSON.stringify(old))).toThrow(/Schema 28/)
    removeLicenseCoverageV29(old);const migrated=parseProject(JSON.stringify(old))
    expect(migrated.schemaVersion).toBe(32);expect(migrated.design.licenses).toEqual(project.design.licenses)
    expect(migrated.design.sqlLicenseUses).toEqual([]);expect(row(migrated,sqlLicense.id).purchaseUnits).toBeNull()
  })
  it('round-trips active coverage, reports one shared plan and removes sensitive evidence for sharing',()=>{
    const {project}=licenseCoverageFixture(),files=environmentFiles(project)
    expect(JSON.parse(files['plans/license-coverage.json'])).toEqual(licenseCoveragePlan(project))
    expect(files['reports/license-coverage.md']).toContain('These mappings add no license quantities')
    expect(files['environment/licensing.yml']).toContain('sqlWorkloads:')
    expect(parseProject(files['project.json']).design.sqlLicenseUses).toEqual(project.design.sqlLicenseUses)
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(shared.design.sqlWorkloads[0].values.use).toBe(shared.design.sqlLicenseUses[0].id)
    expect(licensingPlan(shared).rows.every(r=>r.estimatedCost===null)).toBe(true)
    expect(serializeProject(shared)).not.toContain('EXAMPLE exact supporting technology review')
  })
  it('preserves original schema27 SDN observations across all licensing migrations',()=>{
    const {project}=sdnServicesFixture(),now=new Date().toISOString(),evidence=sdnEvidenceTemplate(project)
    Object.assign(evidence,{id:'example-licensing-migration',observedAt:now,source:{operator:'Example operator',runner:'Example runner',version:'1.0',endpoint:'runner.example.test'}})
    for(const result of evidence.results)Object.assign(result,{status:'passed',observed:'EXAMPLE traffic observation',evidenceRef:'artifact://example/observation'})
    const observed=importSdnEvidence(project,JSON.stringify(evidence),'example-observation.json',now)
    const old:any=structuredClone(observed);old.schemaVersion=27;removeLicensingRightsV28(old)
    const migrated=parseProject(JSON.stringify(old))
    expect(migrated.schemaVersion).toBe(32);expect(migrated.sdnEvidence).toEqual(observed.sdnEvidence)
    expect(sdnEvidenceAssessment(migrated,now)).toMatchObject({status:'passed-observation',runtimeQualified:false,executionAllowed:false})
  })
})
