import {describe,it,expect} from 'vitest'
import {licensingPlan,licenseSummary} from './licensing'
import {licensingFixture} from './testing/licensingFixture'
import {removeLicensingV9} from './testing/legacyLicensing'
import {parseProject,serializeProject} from './project'
import {environmentFiles} from './exports'
import {sanitizeProject} from './sanitize'

describe('licensing assignment and commercial evidence',()=>{
  it('uses per-host peak OSEs, includes reserve destinations and credits exact entitlement units first',()=>{
    const {project}=licensingFixture(),plan=licensingPlan(project)
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
    expect(plan.findings.some(f=>f.code==='LICENSE_COVERAGE_UNMAPPED')).toBe(true)
    expect(plan.rows[0]).toMatchObject({coreLicenses:48,required:24,covered:8,purchaseUnits:16,estimatedCost:160,quantityResolved:true,rightsResolved:true,priceResolved:true})
    expect(plan.rows[0].details).toMatchObject([{calculation:{sets:1,coreLicenses:16}},{calculation:{sets:2,coreLicenses:32}}])
    project.design.clusters[0].values.reserveNodes=0;expect(licenseSummary(project)[0].coreLicenses).toBe(48)
  })
  it('blocks missing, fractional or duplicated inventory instead of emitting a partial total',()=>{
    const {project,host}=licensingFixture();host.values.sockets=0
    expect(licenseSummary(project)[0]).toMatchObject({required:null,coreLicenses:null,purchaseUnits:null,estimatedCost:null})
    host.values.sockets=2;project.design.licenseAssignments[1].values.host=host.id
    expect(licensingPlan(project).findings.some(f=>f.fieldKey==='host')).toBe(true)
    project.design.licenseAssignments[1].values.host='host-b';project.design.licenseAssignments[0].values.peakVirtualOSEs=1.5
    expect(licenseSummary(project)[0].required).toBeNull()
  })
  it('calculates eligible server VM coverage with a separate customer minimum and live vCPU inputs',()=>{
    const {project,vm}=licensingFixture('virtual')
    expect(licenseSummary(project)[0]).toMatchObject({coreLicenses:16,required:8,estimatedCost:80})
    expect(licenseSummary(project)[0].details).toContainEqual({kind:'customer-minimum',vmCoreLicenses:8,minimumTopUp:8})
    vm.vCpu=20;expect(licenseSummary(project)[0]).toMatchObject({coreLicenses:20,required:10,estimatedCost:100})
  })
  it('rejects expired/incomplete VM rights and duplicate customer/product pools',()=>{
    const {project,license}=licensingFixture('virtual');license.values.saExpiry='2026-09-10'
    expect(licenseSummary(project)[0].estimatedCost).toBeNull()
    license.values.saExpiry='2027-09-11';license.values.customerMinimumReview=''
    expect(licenseSummary(project)[0].required).toBeNull()
    license.values.customerMinimumReview='Reviewed';project.design.licenses.push({...structuredClone(license),id:'license-b'})
    expect(licensingPlan(project).findings.some(f=>f.fieldKey==='customerScope')).toBe(true)
  })
  it('separates Windows guest licensing from System Center managed-server scope and excludes unsupported targets',()=>{
    const {project,license,vm}=licensingFixture('virtual');project.design.licenseAssignments[0].values.osClass='other'
    expect(licenseSummary(project)[0].required).toBeNull()
    license.values.product='systemcenter';expect(licenseSummary(project)[0].coreLicenses).toBe(16)
    vm.hosting='physical';expect(licenseSummary(project)[0].required).toBeNull()
    vm.hosting='external';expect(licenseSummary(project)[0].required).toBeNull()
  })
  it('does not apply commercial core formulas to SPLA/OEM or infer included core rights',()=>{
    const {project,license}=licensingFixture()
    for(const program of ['SPLA','OEM']) {license.values.program=program;expect(licenseSummary(project)[0].rightsResolved).toBe(false)}
    license.values.program='Example commercial agreement';license.values.rights='included';license.values.restrictedUse='Example note'
    expect(licenseSummary(project)[0].estimatedCost).toBeNull()
  })
  it('requires a named entitlement pool and catches over-allocation and inconsistent pool metadata',()=>{
    const {project,license}=licensingFixture('manual');license.values.owned=8;license.values.entitlementTotalUnits=8
    const other={...structuredClone(license),id:'license-b'};project.design.licenses.push(other)
    expect(licenseSummary(project).every(r=>r.purchaseUnits===null)).toBe(true)
    license.values.entitlementTotalUnits=16;other.values.entitlementTotalUnits=16
    expect(licenseSummary(project).every(r=>r.purchaseUnits===16)).toBe(true)
    other.values.unitBasis='core';expect(licenseSummary(project).every(r=>r.rightsResolved===false)).toBe(true)
    project.design.licenses.pop();license.values.entitlementId='';expect(licenseSummary(project)[0].rightsResolved).toBe(false)
  })
  it('keeps an unquoted zero price unresolved and requires explicit dated no-charge evidence',()=>{
    const {project,license}=licensingFixture('manual');license.values.unitPrice=0;license.values.quoteStatus='review'
    expect(licenseSummary(project)[0]).toMatchObject({required:24,purchaseUnits:24,estimatedCost:null,priceResolved:false})
    license.values.quoteStatus='nocharge';expect(licenseSummary(project)[0].estimatedCost).toBe(0)
    license.values.quoteSource='';expect(licenseSummary(project)[0].estimatedCost).toBeNull()
    license.values.quoteSource='Reviewed quote';license.values.quoteDate='2026-02-30';expect(licenseSummary(project)[0].estimatedCost).toBeNull()
    license.values.quoteDate='2026-09-12';expect(licenseSummary(project)[0].estimatedCost).toBeNull()
  })
  it('keeps currencies and recurring/perpetual periods separate and labels incomplete totals',()=>{
    const {project,license}=licensingFixture('manual')
    const second={...structuredClone(license),id:'license-b'};second.values.currency='EUR';second.values.term='monthly';project.design.licenses.push(second)
    const third={...structuredClone(license),id:'license-c'};third.values.quoteStatus='review';project.design.licenses.push(third)
    expect(licensingPlan(project).totals).toEqual([{currency:'EUR',term:'monthly',knownEstimate:240,complete:true,quotedItems:1,unresolvedItems:0},{currency:'USD',term:'perpetual',knownEstimate:240,complete:false,quotedItems:1,unresolvedItems:1}])
  })
  it('requires a structured SQL scope before crediting an included-use note',()=>{
    const {project,license}=licensingFixture('manual');license.values.product='sql';license.values.rights='included';license.values.restrictedUse='Reviewed supporting SQL use; no unrelated workloads.'
    expect(licenseSummary(project)[0]).toMatchObject({purchaseUnits:null,estimatedCost:null})
    expect(licensingPlan(project).findings.some(f=>f.code==='LICENSE_COVERAGE_SQL_SCOPE_MISSING')).toBe(true)
    license.values.restrictedUse='';expect(licenseSummary(project)[0].estimatedCost).toBeNull()
  })
  it('withholds aggregate estimates beyond the exact numeric range',()=>{
    const {project,license}=licensingFixture('manual');license.values.required=1e9;license.values.unitPrice=1e6
    for(let i=1;i<10;i++)project.design.licenses.push({...structuredClone(license),id:`license-${i}`})
    const plan=licensingPlan(project)
    expect(plan.rows.every(r=>r.estimatedCost===1e15)).toBe(true)
    expect(plan.totals[0]).toMatchObject({knownEstimate:null,complete:false,rangeReview:true})
    expect(plan.findings.some(f=>f.code==='LICENSE_TOTAL_RANGE')).toBe(true)
  })
  it('preserves assignments and assessment through reopen and deterministic exports while shared evidence stays unresolved',()=>{
    const {project}=licensingFixture(),before=serializeProject(project),files=environmentFiles(project)
    expect(environmentFiles(project)).toEqual(files);expect(serializeProject(project)).toBe(before)
    expect(JSON.parse(files['plans/licensing-assessment.json'])).toEqual(licensingPlan(project))
    expect(files['reports/licensing.md']).toContain('| 48 | 24 | 8 | 16 | Two-core pack | USD 160 / perpetual |')
    expect(parseProject(files['project.json']).design.licenseAssignments).toEqual(project.design.licenseAssignments)
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(shared.design.licenseAssignments[0].values.host).toBe(shared.design.hosts[0].id)
    expect(licenseSummary(shared)[0].estimatedCost).toBeNull()
  })
  it('migrates old quantities as manual/unquoted and rejects schema 9 fields in older files',()=>{
    const {project}=licensingFixture(),legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=8
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 8')
    removeLicensingV9(legacy)
    const next=parseProject(JSON.stringify(legacy))
    expect(next.schemaVersion).toBe(32);expect(next.id).toBe(project.id);expect(next.revision).toBe(project.revision)
    expect(next.design.licenses[0].values).toMatchObject({required:24,owned:8,calculationModel:'manual',quoteStatus:'review',entitlementId:''})
    expect(next.design.licenseAssignments).toEqual([]);expect(licenseSummary(next)[0].estimatedCost).toBeNull()
  })
})
