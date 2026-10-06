import {describe,it,expect} from 'vitest'
import {licensingFixture} from './testing/licensingFixture'
import {removeLicensingRightsV28} from './testing/legacyLicensingRights'
import {licensingPlan} from './licensing'
import {parseProject,serializeProject} from './project'
import {sanitizeProject} from './sanitize'
import {environmentFiles} from './exports'
import {sdnServicesFixture} from './testing/sdnServicesFixture'
import {removeSdnServicesV25} from './testing/legacySdnServices'

describe('commercial rights and independent activation review',()=>{
  it('requires commercial evidence before crediting otherwise valid coverage',()=>{
    const {project,license}=licensingFixture()
    expect(licensingPlan(project).rows[0].estimatedCost).toBe(160)
    for(const key of ['commercialProgram','agreementRef','rightsOwner','rightsEvidence','termStart','assignedAt','mobilityEvidence']){
      const original=license.values[key];license.values[key]=''
      expect(licensingPlan(project).rows[0],key).toMatchObject({required:24,purchaseUnits:null,estimatedCost:null,rightsResolved:false})
      license.values[key]=original
    }
  })
  it('does not substitute activation for entitlement or hide valid quantities when activation is missing',()=>{
    const {project,license}=licensingFixture()
    license.values.activationEvidence=''
    let row=licensingPlan(project).rows[0]
    expect(row).toMatchObject({rightsResolved:true,estimatedCost:160,commercial:{activation:{resolved:false,establishesEntitlement:false}}})
    license.values.activationEvidence='EXAMPLE reviewed KMS';license.values.rightsEvidence=''
    row=licensingPlan(project).rows[0]
    expect(row).toMatchObject({rightsResolved:false,estimatedCost:null,commercial:{activation:{resolved:true,establishesEntitlement:false}}})
  })
  it('checks real term dates and preserves historical assignment dates across SA renewal',()=>{
    const {project,license}=licensingFixture()
    license.values.assignedAt='2025-01-01'
    expect(licensingPlan(project).rows[0].rightsResolved).toBe(true)
    for(const value of ['2026-02-30','2027-01-01','']){
      license.values.termStart=value;expect(licensingPlan(project).rows[0].rightsResolved,value).toBe(false)
    }
    license.values.termStart='2026-01-01';license.values.saExpiry='2026-09-10'
    expect(licensingPlan(project).rows[0].rightsResolved).toBe(false)
    license.values.saExpiry='2026-09-11';expect(licensingPlan(project).rows[0].rightsResolved).toBe(true)
    license.values.entitlementTerm='perpetual';license.values.saExpiry=''
    expect(licensingPlan(project).rows[0].rightsResolved).toBe(true)
  })
  it('requires per-VM eligibility to match its commercial term and limits automatic mobility claims',()=>{
    const {project,license}=licensingFixture('virtual')
    license.values.entitlementTerm='subscription'
    expect(licensingPlan(project).rows[0].rightsResolved).toBe(false)
    license.values.vmEligibility='subscription'
    expect(licensingPlan(project).rows[0].estimatedCost).toBe(80)
    license.values.entitlementTerm='perpetual';expect(licensingPlan(project).rows[0].rightsResolved).toBe(false)
    const physical=licensingFixture();physical.license.values.reassignmentBasis='vmMobility'
    expect(licensingPlan(physical.project).rows[0].rightsResolved).toBe(false)
  })
  it('keeps noncommercial programs manual and requires explicit hosted-provider review',()=>{
    const {project,license}=licensingFixture()
    for(const program of ['oem','spla','provider','other']){
      license.values.commercialProgram=program
      expect(licensingPlan(project).rows[0].rightsResolved,program).toBe(false)
    }
    const manual=licensingFixture('manual');manual.license.values.commercialProgram='spla';manual.license.values.context='hosted'
    expect(licensingPlan(manual.project).rows[0].rightsResolved).toBe(false)
    manual.license.values.providerRightsEvidence='EXAMPLE named provider and customer rights review'
    expect(licensingPlan(manual.project).rows[0].rightsResolved).toBe(true)
    manual.license.values.commercialProgram='provider';manual.license.values.entitlementTerm='provider';manual.license.values.reassignmentBasis='provider'
    expect(licensingPlan(manual.project).rows[0].rightsResolved).toBe(true)
  })
  it('rejects literal product keys at save/import boundaries and preserves runtime references',()=>{
    const {project,license}=licensingFixture()
    // Deliberately synthetic key-shaped text, never a usable product key.
    license.values.activationRef='AAAAA-BBBBB-CCCCC-DDDDD-EEEEE'
    expect(()=>serializeProject(project)).toThrow(/never a product key/)
    expect(()=>parseProject(JSON.stringify(project))).toThrow(/never a product key/)
    license.values.activationRef='keyvault://example/activation'
    expect(parseProject(serializeProject(project)).design.licenses[0].values.activationRef).toBe(license.values.activationRef)
  })
  it('migrates schema27 without inventing commercial rights and rejects mixed-schema fields',()=>{
    const {project}=licensingFixture(),old:any=structuredClone(project);old.schemaVersion=27
    expect(()=>parseProject(JSON.stringify(old))).toThrow(/Schema 27/)
    removeLicensingRightsV28(old)
    const migrated=parseProject(JSON.stringify(old))
    expect(migrated.schemaVersion).toBe(32)
    expect(migrated.design.licenses[0].values).toMatchObject({owned:8,required:24,commercialProgram:'',activationMethod:'',rightsOwner:''})
    expect(licensingPlan(migrated).rows[0]).toMatchObject({required:24,rightsResolved:false,estimatedCost:null})
  })
  it('exports one commercial contract and redacts shareable evidence without retaining reviewed status',()=>{
    const {project}=licensingFixture(),files=environmentFiles(project),assessment=JSON.parse(files['plans/licensing-assessment.json'])
    expect(assessment.rows[0].commercial).toEqual(licensingPlan(project).rows[0].commercial)
    expect(files['reports/licensing.md']).toContain('Activation never establishes entitlement.')
    expect(files['reports/licensing.md']).toContain('EXAMPLE agreement evidence')
    expect(files['environment/licensing.yml']).toContain('commercialProgram: commercial')
    const shared=parseProject(serializeProject(sanitizeProject(project))),review=licensingPlan(shared).rows[0].commercial
    expect(review.rightsResolved).toBe(false);expect(review.activation.resolved).toBe(false)
    expect(serializeProject(shared)).not.toContain('EXAMPLE agreement evidence')
  })
  it('preserves populated SDN schema25 service objects while migrating license rights to schema28',()=>{
    const {project}=sdnServicesFixture();project.design.licenses.push(licensingFixture().license)
    const old:any=structuredClone(project);old.schemaVersion=27;removeLicensingRightsV28(old)
    const migrated=parseProject(JSON.stringify(old))
    expect(migrated.design.sdnTrafficRules).toEqual(project.design.sdnTrafficRules)
    expect(migrated.design.sdnConnections).toEqual(project.design.sdnConnections)
    expect(migrated.design.licenses[0].values).toMatchObject({owned:8,commercialProgram:'',rightsEvidence:''})
    const older:any=structuredClone(project);older.schemaVersion=24;removeSdnServicesV25(older)
    const both=parseProject(JSON.stringify(older))
    expect(both.schemaVersion).toBe(32);expect(both.design.sdnTrafficRules).toEqual([])
    expect(both.design.licenses[0].values).toMatchObject({owned:8,commercialProgram:''})
  })
})
