import {describe,it,expect} from 'vitest'
import {licenseDependencyFixture} from './testing/licenseDependencyFixture'
import {licensingPlan} from './licensing'
import {licenseDependencyPlan} from './licenseDependencies'
import {parseProject,serializeProject} from './project'
import {sanitizeProject} from './sanitize'
import {environmentFiles} from './exports'
import {removeLicenseDependenciesV30} from './testing/legacyLicenseDependencies'

describe('access, Azure and feature dependency licensing',()=>{
  it('credits existing audiences, decimal Azure units and shared OME entitlements once',()=>{
    const {project}=licenseDependencyFixture(),plan=licensingPlan(project)
    expect(licenseDependencyPlan(project).findings).toEqual([])
    expect(plan.rows.find(r=>r.id==='base-access')).toMatchObject({purchaseUnits:6,estimatedCost:30,rightsResolved:true})
    expect(plan.rows.find(r=>r.id==='rds-access')).toMatchObject({purchaseUnits:10,estimatedCost:70})
    expect(plan.rows.find(r=>r.id==='monitor-meter')).toMatchObject({required:12.5,covered:2.25,purchaseUnits:10.25,estimatedCost:30.75})
    expect(plan.rows.find(r=>r.id==='ome-entitlement')).toMatchObject({purchaseUnits:0,estimatedCost:0})
    expect(plan.coverage.objects.licenseDependencies).toHaveLength(2)
    expect(plan.coverage.addsLicenseQuantity).toBe(false)
  })
  it('withholds RDS credit when base rights or matching audience are missing',()=>{
    const {project,base,access,rds}=licenseDependencyFixture(),result=()=>licensingPlan(project).rows.find(r=>r.id===rds.id)!
    base.values.rightsEvidence='';expect(result().rightsResolved).toBe(false)
    base.values.rightsEvidence='EXAMPLE terms';base.values.quoteStatus='review';expect(result().rightsResolved).toBe(true)
    access.values.audience='EXAMPLE other users';expect(result().rightsResolved).toBe(false)
    access.values.audience='EXAMPLE operators';access.values.metric='device';expect(result().rightsResolved).toBe(false)
  })
  it('rejects duplicate audience charges, wrong counting units and provider SAL without a contract',()=>{
    const {project,add,access,base}=licenseDependencyFixture()
    add('accessRights','duplicate',{...access.values});expect(licenseDependencyPlan(project).findings.some(f=>f.code==='LICENSE_DEPENDENCY_ACCESS_OVERLAP')).toBe(true)
    project.design.accessRights.pop();access.values.quantity=9;expect(licensingPlan(project).rows.find(r=>r.id===base.id)?.rightsResolved).toBe(false)
    access.values.quantity=10;access.values.kind='sal';expect(licenseDependencyPlan(project).findings.some(f=>f.code==='LICENSE_DEPENDENCY_SAL_PROGRAM')).toBe(true)
    Object.assign(base.values,{context:'hosted',commercialProgram:'provider',entitlementTerm:'provider',reassignmentBasis:'provider',providerRightsEvidence:'EXAMPLE specific SAL program'})
    expect(licensingPlan(project).rows.find(r=>r.id===base.id)?.rightsResolved).toBe(true)
    Object.assign(base.values,{commercialProgram:'spla',entitlementTerm:'subscription',reassignmentBasis:'fixed'})
    expect(licensingPlan(project).rows.find(r=>r.id===base.id)?.rightsResolved).toBe(true)
    access.values.metric='server';expect(licensingPlan(project).rows.find(r=>r.id===base.id)?.rightsResolved).toBe(false)
  })
  it('requires exact Azure meter units and periods and never infers benefits from Arc',()=>{
    const {project,meter,azure}=licenseDependencyFixture(),result=()=>licensingPlan(project).rows.find(r=>r.id===azure.id)!
    meter.values.period='annual';expect(result().estimatedCost).toBeNull()
    meter.values.period='monthly';meter.values.unit='MB';expect(result().estimatedCost).toBeNull()
    meter.values.unit='GB ingested';meter.values.benefit='none';expect(result().estimatedCost).toBeNull()
    meter.values.service='arc';expect(result().estimatedCost).toBeNull()
    meter.values.benefit='allocation';meter.values.benefitEvidence='';expect(result().estimatedCost).toBeNull()
    meter.values.benefitEvidence='EXAMPLE reviewed';meter.values.benefit='included';azure.values.rights='included';azure.values.owned=0;azure.values.restrictedUse='EXAMPLE exact full-service inclusion';expect(result().purchaseUnits).toBe(0)
  })
  it('blocks duplicate meter scope even when mapped to another representative resource',()=>{
    const {project,add,meter,azure,commercial}=licenseDependencyFixture(),other=commercial('extra-meter','azure',{...azure.values,name:'EXAMPLE duplicate'})
    add('azureLicenseMeters','extra-scope',{...meter.values,license:other.id,target:'host-a'})
    const plan=licensingPlan(project);expect(plan.rows.filter(r=>[azure.id,other.id].includes(r.id)).every(r=>r.estimatedCost===null)).toBe(true)
  })
  it('keeps core/access quantities integral and rejects unsupported fractional precision',()=>{
    const {project,base,azure,meter}=licenseDependencyFixture()
    base.values.required=10.5;expect(licensingPlan(project).rows.find(r=>r.id===base.id)?.quantityResolved).toBe(false)
    azure.values.required=12.0000001;meter.values.quantity=12.0000001;expect(licensingPlan(project).rows.find(r=>r.id===azure.id)?.quantityResolved).toBe(false)
    azure.values.required=0.3;meter.values.quantity=0.3;azure.values.owned=0.1;azure.values.entitlementTotalUnits=0.1
    expect(licensingPlan(project).rows.find(r=>r.id===azure.id)).toMatchObject({purchaseUnits:0.2,estimatedCost:0.6})
  })
  it('does not allocate one Azure meter-unit pool to a different meter',()=>{
    const {project,add,meter,azure,commercial}=licenseDependencyFixture(),second=commercial('other-azure','azure',{...azure.values,name:'EXAMPLE other meter',owned:1,entitlementTotalUnits:10})
    azure.values.entitlementTotalUnits=10
    add('azureLicenseMeters','other-meter',{...meter.values,license:second.id,meter:'EXAMPLE different meter',scope:'EXAMPLE different resource scope'})
    expect(licensingPlan(project).rows.filter(r=>r.product==='azure').every(r=>r.estimatedCost===null)).toBe(true)
  })
  it('withholds all unsupported or missing scope credits while preserving known quantities',()=>{
    const {project}=licenseDependencyFixture();project.design.accessRights=[];project.design.azureLicenseMeters=[];project.design.licenseDependencies=[]
    const rows=licensingPlan(project).rows.filter(r=>['access','azure','ome'].includes(r.product))
    expect(rows.every(r=>r.quantityResolved&&r.purchaseUnits===null)).toBe(true)
  })
  it('blocks repeated feature charges and mismatched OME resource or product',()=>{
    const {project,add,dependency,ome}=licenseDependencyFixture()
    add('licenseDependencies','same-feature',{...dependency.values});expect(licensingPlan(project).rows.find(r=>r.id===ome.id)?.estimatedCost).toBeNull()
    project.design.licenseDependencies.pop();dependency.values.target='vm-a';expect(licenseDependencyPlan(project).findings.some(f=>f.code==='LICENSE_DEPENDENCY_OME_TARGET')).toBe(true)
    dependency.values.target='ome-example';ome.values.product='windows';expect(licenseDependencyPlan(project).findings.some(f=>f.code==='LICENSE_DEPENDENCY_PRODUCT')).toBe(true)
  })
  it('requires actual Windows coverage for an SDN OS dependency without adding quantities',()=>{
    const {project,add,license}=licenseDependencyFixture()
    const link=add('licenseDependencies','sdn-os',{license:license.id,category:'sdn',target:'host-a',feature:'EXAMPLE host OS role',inventoryEvidence:'EXAMPLE host scope',versionEvidence:'EXAMPLE OS rights',coverageEvidence:'EXAMPLE assignment reviewed'})
    expect(licenseDependencyPlan(project).findings).toEqual([])
    const before=licensingPlan(project).rows.find(r=>r.id===license.id)?.required
    link.values.target='ome-example';expect(licenseDependencyPlan(project).findings.some(f=>f.code==='LICENSE_DEPENDENCY_SDN_OS_SCOPE')).toBe(true)
    expect(licensingPlan(project).rows.find(r=>r.id===license.id)?.required).toBe(before)
  })
  it('migrates schema29 without invented rights and includes dependencies in every shared contract',()=>{
    const {project}=licenseDependencyFixture(),old:any=structuredClone(project);old.schemaVersion=29
    expect(()=>parseProject(JSON.stringify(old))).toThrow(/Schema 29/);removeLicenseDependenciesV30(old)
    const migrated=parseProject(JSON.stringify(old));expect(migrated.schemaVersion).toBe(32);expect(migrated.design.azureLicenseMeters).toEqual([])
    expect(migrated.design.licenses).toEqual(project.design.licenses)
    const files=environmentFiles(project);expect(files['environment/licensing.yml']).toContain('azureLicenseMeters:')
    expect(JSON.parse(files['plans/license-coverage.json']).objects.accessRights).toHaveLength(2)
    expect(parseProject(files['project.json']).design.licenseDependencies).toEqual(project.design.licenseDependencies)
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(shared.design.accessRights[1].values.baseLicense).toBe(shared.design.licenses.find(l=>l.values.product==='access')?.id)
    expect(licensingPlan(shared).rows.every(r=>r.estimatedCost===null)).toBe(true)
    expect(serializeProject(shared)).not.toContain('EXAMPLE operators')
  })
})
