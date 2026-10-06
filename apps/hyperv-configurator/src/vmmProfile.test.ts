import { describe, it, expect } from 'vitest'
import { collections, profileCreationFields, visibleField } from './catalog'
import { newProject, parseProject, serializeProject } from './project'
import { vmmProfilePlan } from './vmmProfile'
import { environmentFiles } from './exports'
import { sanitizeProject } from './sanitize'
import { vmmProfileFixture } from './testing/vmmProfileFixture'
import { removeProfilesV8 } from './testing/legacyProfiles'

describe('desired VMM profile handoff',()=>{
  it('maps creation data without inventing an object ID or unblocking host submission',()=>{
    const {project}=vmmProfileFixture(), before=serializeProject(project), plan=vmmProfilePlan(project)
    expect(plan.findings).toEqual([]);expect(plan).toMatchObject({status:'design-handoff',runtimeQualified:false,automationReady:false,executionState:'not-executed'})
    expect(plan.targets[0]).toMatchObject({hostIds:['host-a'],os:{timeZoneId:0},storage:{bypassVhdConversion:false,vmPaths:['C:\\VirtualMachines']},result:{physicalComputerProfileId:null,reviewed:false}})
    expect(serializeProject(project)).toBe(before)
  })
  it('keeps existing profiles and non-VMM methods outside creation scope',()=>{
    const {project,profile}=vmmProfileFixture();profile.values.profileState='existing'
    expect(vmmProfilePlan(project).status).toBe('not-selected');expect(profileCreationFields.every(f=>!visibleField(f,profile.values))).toBe(true)
    profile.values.profileState='create';profile.values.method='manual'
    expect(vmmProfilePlan(project).status).toBe('not-selected');expect(profileCreationFields.every(f=>!visibleField(f,profile.values))).toBe(true)
    expect(environmentFiles(newProject())['handoffs/vmm-profiles/plan.json']).toBeUndefined()
  })
  it('blocks missing IDs, incomplete artifacts, version guesses and existing-scope creation',()=>{
    const {project,profile,media}=vmmProfileFixture();project.scope='existing';profile.values.profileRef='existing-id';profile.values.virtualHardDiskId='image-name';profile.values.vmmModuleVersion='latest';media.values.sha256='unknown'
    expect(vmmProfilePlan(project).findings.map(f=>f.fieldKey)).toEqual(expect.arrayContaining(['profileState','profileRef','virtualHardDiskId','vmmModuleVersion','image']))
  })
  it('checks domain and workgroup parameter exclusivity without dropping retained answers',()=>{
    const {project,profile}=vmmProfileFixture();profile.values.joinMode='workgroup'
    expect(vmmProfilePlan(project).status).toBe('blocked');expect(profile.values.profileDomain).toBe('example.test')
    profile.values.profileDomain='';profile.values.domainJoinRunAsId=''
    expect(vmmProfilePlan(project).status).toBe('design-handoff');expect(vmmProfilePlan(project).findings.some(f=>f.severity==='warning')).toBe(true)
    profile.values.joinMode='domain';expect(vmmProfilePlan(project).status).toBe('blocked')
  })
  it('rejects duplicate NIC IDs and paths while retaining reviewed order',()=>{
    const {project,profile}=vmmProfileFixture();profile.values.networkAdapterProfileIds+='\n88888888-8888-8888-8888-888888888888';profile.values.vmPaths='C:\\VMs\nc:/vms/'
    expect(vmmProfilePlan(project).findings.map(f=>f.fieldKey)).toEqual(expect.arrayContaining(['networkAdapterProfileIds','vmPaths']))
    profile.values.networkAdapterProfileIds='99999999-9999-9999-9999-999999999999\n88888888-8888-8888-8888-888888888888'
    expect(vmmProfilePlan(project).targets[0].networkAdapterProfileIds[0]).toBe('99999999-9999-9999-9999-999999999999')
  })
  it('blocks mismatched firmware, unknown disk targets and unreviewed disk strings',()=>{
    const {project,profile,host}=vmmProfileFixture();host.values.boot='uefi';host.values.bootDisk='';profile.values.diskConfiguration='GPT=unreviewed;';profile.values.diskConfigurationEvidence=''
    expect(vmmProfilePlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['VMM_PROFILE_BOOT','VMM_PROFILE_BOOT_DISK','VMM_PROFILE_DISKCONFIGURATION','VMM_PROFILE_DISKCONFIGURATIONEVIDENCE']))
    expect(vmmProfilePlan(project).findings.find(f=>f.code==='VMM_PROFILE_BOOT')?.recordId).toBe(host.id)
  })
  it('requires complete optional answer-file references and never accepts credential literals',()=>{
    const {project,profile}=vmmProfileFixture();profile.values.answerFile='library/unattend.xml';profile.values.localAdminCredentialRef='literal-value'
    expect(vmmProfilePlan(project).findings.map(f=>f.fieldKey)).toEqual(expect.arrayContaining(['answerFileId','localAdminCredentialRef']))
    expect(()=>serializeProject(project)).toThrow('runtime credential reference must use')
    profile.values.localAdminCredentialRef='secret-ref://example/local-admin';profile.values.answerFileId='99999999-9999-9999-9999-999999999999';profile.values.answerFileSha256='b'.repeat(64)
    expect(vmmProfilePlan(project).findings).toEqual([])
  })
  it('detects same-server duplicate names and does not confuse other endpoints',()=>{
    const {project,profile}=vmmProfileFixture();project.design.profiles.push({...structuredClone(profile),id:'profile-b'})
    expect(vmmProfilePlan(project).findings.filter(f=>f.code==='VMM_PROFILE_NAME')).toHaveLength(2)
    project.design.profiles[1].values.vmmEndpoint='other.example.test'
    expect(vmmProfilePlan(project).findings).toEqual([])
  })
  it('requires pinned reviewed driver artifacts for tagged selection and preserves PnP intent',()=>{
    const {project,profile,media}=vmmProfileFixture();profile.values.driverMatchingTags='example-model'
    expect(vmmProfilePlan(project).findings.some(f=>f.fieldKey==='driverSelection')).toBe(true)
    profile.values.driverSelection='tags';profile.values.driverArtifact=media.id
    expect(vmmProfilePlan(project).findings.some(f=>f.fieldKey==='driverArtifact')).toBe(true)
    const driver={...structuredClone(media),id:'driver-a'};driver.values.kind='driver';driver.values.signature='Example publisher review';project.design.media.push(driver);profile.values.driverArtifact=driver.id
    expect(vmmProfilePlan(project).findings).toEqual([])
    expect(vmmProfilePlan(project).targets[0].drivers).toMatchObject({selection:'tags',matchingTags:['example-model'],artifact:{id:'driver-a',sha256:'a'.repeat(64)}})
  })
  it('preserves creation fields in reopen, reports and schedules and scrubs operational IDs when shared',()=>{
    const {project}=vmmProfileFixture(), files=environmentFiles(project)
    expect(environmentFiles(project)).toEqual(files)
    const next=parseProject(files['project.json']);expect(next.design.profiles).toEqual(project.design.profiles)
    expect(JSON.parse(files['handoffs/vmm-profiles/plan.json'])).toEqual(vmmProfilePlan(project))
    expect(files['reports/design.md']).toContain('Local administrator runtime credential reference')
    expect(files['reports/implementation-plan.md']).toContain('VMM physical-profile creation handoff')
    expect(files['handoffs/vmm-profiles/README.md']).toContain('New-SCPhysicalComputerProfile')
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(vmmProfilePlan(shared).status).toBe('blocked');expect(JSON.stringify(vmmProfilePlan(shared))).not.toContain('vmm.example.test')
    expect(vmmProfilePlan(shared).targets[0].localAdminCredentialRef).toBe('secret-ref://withheld/reference')
  })
  it('migrates old projects with empty creation inputs and rejects future-field smuggling',()=>{
    const {project}=vmmProfileFixture(), legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=7
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 7')
    removeProfilesV8(legacy)
    const next=parseProject(JSON.stringify(legacy))
    expect(next.schemaVersion).toBe(32);expect(next.id).toBe(project.id);expect(next.revision).toBe(project.revision)
    for(const field of profileCreationFields)expect(next.design.profiles[0].values[field.key]).toBe('')
    expect(vmmProfilePlan(next).status).toBe('blocked')
    expect(new Set(collections.find(c=>c.key==='profiles')!.fields.map(f=>f.key)).size).toBe(collections.find(c=>c.key==='profiles')!.fields.length)
  })
})
