import type { Project } from './project'
import type { Finding } from './validation'
import { absoluteStoragePath, normalizeStoragePath } from './storageLayout'

const guid = (s: string) => /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(s) && !/^0{8}(-0{4}){3}-0{12}$/.test(s)
const dns = (s: string) => s.length <= 253 && s.includes('.') && !/^[\d.]+$/.test(s) && s.split('.').every(p => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(p))
const lines = (s: string) => s.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
export const VMM_PROFILE_SOURCES = [
  'https://learn.microsoft.com/en-us/powershell/module/virtualmachinemanager/new-scphysicalcomputerprofile?view=systemcenter-ps-2025',
  'https://learn.microsoft.com/en-us/system-center/vmm/library-profiles?view=sc-vmm-2025',
] as const

/** An operator creation handoff, never a bare-metal execution target or an inferred VMM object. */
export function vmmProfilePlan(project: Project) {
  const findings: Finding[] = []
  const selected = project.design.profiles.filter(p => p.values.method === 'vmm' && p.values.profileState === 'create')
  const targets = [...selected].sort((a,b) => a.id.localeCompare(b.id)).map(profile => {
    const p = profile.values, s = (key: string) => String(p[key] ?? '').trim()
    const add = (key: string, message: string, severity: Finding['severity'] = 'error') => findings.push({code: `VMM_PROFILE_${key.toUpperCase()}`, section: 'hardware', recordId: profile.id, fieldKey: key, severity, message: `${s('name') || 'Unnamed profile'}: ${message}`})
    const nicIds = lines(s('networkAdapterProfileIds')).map(s => s.toLowerCase())
    const paths = lines(s('vmPaths')), tags = lines(s('driverMatchingTags'))
    const image = project.design.media.find(m => m.id === s('image'))
    const driver = project.design.media.find(m => m.id === s('driverArtifact'))
    const hosts = project.design.hosts.filter(h => h.values.profile === profile.id)
    if (project.scope === 'existing') add('profileState', 'An existing-environment documentation scope cannot request new profile creation.')
    if (s('profileRef')) add('profileRef', 'Clear the existing profile reference for a new profile. Record a returned ID only after creation and review, then select Use existing profile.')
    for (const key of ['name','owner','hardwareApplicability','storagePrerequisites','preflight','profileAcceptance','networkAdapterReview','diskConfigurationEvidence','locale','activation']) if (!s(key)) add(key, `Record ${key} for the operator handoff.`)
    for (const key of ['vmmVersion','vmmModuleVersion']) if (!/^\d+\.\d+\.\d+\.\d+$/.test(s(key))) add(key, 'Record an exact four-part installed version.')
    if (!dns(s('vmmEndpoint'))) add('vmmEndpoint', 'Use the qualified VMM service FQDN.')
    if (!guid(s('virtualHardDiskId'))) add('virtualHardDiskId', 'Select a non-zero VMM library disk GUID; a path or name is not the object identity.')
    if (!image || !['vhd','vhdx'].includes(String(image.values.kind)) || !/^[a-f\d]{64}$/i.test(String(image.values.sha256)) || !image.values.version || !image.values.source) add('image', 'Select a generalized VHD/VHDX artifact with an exact version, source and SHA-256; verify it matches the VMM library object.')
    if (!absoluteStoragePath(s('libraryPath'))) add('libraryPath', 'Record the absolute VHD/VHDX library path.')
    if (!['ws2022','ws2025','legacy'].includes(s('os')) || !['core','desktop'].includes(s('installType'))) add('installType', 'Select the guest OS release and installation type matching the library image.')
    if (!['fixed','retain'].includes(s('vhdConversion'))) add('vhdConversion', 'Explicitly choose conversion to fixed or retention of the source allocation type.')
    if (!['domain','workgroup'].includes(s('joinMode'))) add('joinMode', 'Choose domain or workgroup membership.')
    if (s('joinMode') === 'domain') {
      if (!dns(s('profileDomain'))) add('profileDomain', 'Record the AD domain FQDN.')
      if (!guid(s('domainJoinRunAsId'))) add('domainJoinRunAsId', 'Record the domain join Run As account GUID.')
    } else if (s('joinMode') === 'workgroup') {
      if (s('profileDomain') || s('profileDomainOu') || s('domainJoinRunAsId')) add('joinMode', 'Clear retained domain fields before requesting a workgroup profile.')
      add('joinMode', 'Workgroup membership requires version, management-access and cluster-design support review.', 'warning')
    }
    if (!/^(keyvault|secret-ref):\/\/[^\s]+$/.test(s('localAdminCredentialRef'))) add('localAdminCredentialRef', 'Use a runtime credential reference; never include a local administrator password.')
    if (s('computerAccessRunAsId') && !guid(s('computerAccessRunAsId'))) add('computerAccessRunAsId', 'Use an existing computer access Run As account GUID.')
    if (!nicIds.length || nicIds.some(id => !guid(id)) || new Set(nicIds).size !== nicIds.length) add('networkAdapterProfileIds', 'List distinct physical NIC profile GUIDs, one per line. Verify order, CDN/MAC matching, IP allocation and logical switch ownership in the mapping review.')
    if (!['gpt','mbr'].includes(s('partitionStyle'))) add('partitionStyle', 'Choose the OS disk partition style.')
    // This string is retained verbatim as data. Its undocumented full grammar is not guessed or executed.
    if (!s('diskConfiguration').toUpperCase().startsWith(`${s('partitionStyle').toUpperCase()}=`) || !s('diskConfiguration').endsWith(';') || /[\r\n\x00-\x1f]/.test(s('diskConfiguration'))) add('diskConfiguration', 'Supply the single-line VMM disk layout reviewed on this build, matching the selected partition style and ending with a semicolon. Syntax recognition is not disk-layout qualification.')
    if (!paths.length || paths.some(path => !absoluteStoragePath(path)) || new Set(paths.map(normalizeStoragePath)).size !== paths.length) add('vmPaths', 'List distinct absolute VM placement paths, one per line.')
    if (new Set(tags.map(t=>t.toLowerCase())).size !== tags.length) add('driverMatchingTags', 'Remove duplicate driver tags.')
    if (!['pnp','tags'].includes(s('driverSelection')) || (s('driverSelection') === 'tags' && !tags.length) || (s('driverSelection') === 'pnp' && tags.length)) add('driverSelection', 'Choose Plug and Play matching without retained tags, or explicitly select reviewed driver tags.')
    if ((s('driverArtifact') || s('driverPackage') || s('driverSelection') === 'tags') && (!driver || driver.values.kind !== 'driver' || !/^[a-f\d]{64}$/i.test(String(driver.values.sha256)) || !driver.values.source || !driver.values.version || !driver.values.signature)) add('driverArtifact', 'Select the qualified driver artifact with a version, source, SHA-256 and signature/publisher review.')
    if (!!s('answerFile') !== !!s('answerFileId') || !!s('answerFileId') !== !!s('answerFileSha256') || (s('answerFileId') && (!guid(s('answerFileId')) || !/^[a-f\d]{64}$/i.test(s('answerFileSha256'))))) add('answerFileId', 'An answer file needs its library reference, exact object GUID and SHA-256 together. Review its contents for secrets and OS applicability outside this project.')
    if (!/^\d{1,4}$/.test(s('timeZoneId'))) add('timeZoneId', 'Record the numeric VMM time zone ID verified for this build; zero is a valid explicit input.')
    for (const host of hosts) {
      const boot = host.values.boot, expected = s('partitionStyle') === 'gpt' ? 'uefi' : 'bios'
      if (!boot || boot !== expected) findings.push({code:'VMM_PROFILE_BOOT',section:'hardware',recordId:host.id,fieldKey:'boot',severity:'error',message:`${host.values.name}: firmware boot mode must match profile ${s('name')} (${expected}).`})
      if (!host.values.bootDisk || !host.values.partitionLayout) findings.push({code:'VMM_PROFILE_BOOT_DISK',section:'hardware',recordId:host.id,fieldKey:!host.values.bootDisk?'bootDisk':'partitionLayout',severity:'error',message:`${host.values.name}: identify the OS disk and reviewed partition layout before applying this profile.`})
    }
    const duplicate = selected.some(other => other.id !== profile.id && String(other.values.name).trim().toLowerCase() === s('name').toLowerCase() && String(other.values.vmmEndpoint).trim().toLowerCase() === s('vmmEndpoint').toLowerCase())
    if (duplicate) add('name', 'New profile names must be unique within the VMM endpoint; the operator must also check the current library before creation.')
    return {
      id: profile.id, name: s('name'), owner: s('owner'), hostIds: hosts.map(h=>h.id).sort(),
      vmmServer:s('vmmEndpoint'), vmmVersion:s('vmmVersion'), moduleVersion:s('vmmModuleVersion'),
      virtualHardDisk:{id:s('virtualHardDiskId').toLowerCase(),recordId:image?.id || '',path:s('libraryPath'),artifact:image ? {...image.values} : null},
      membership:{mode:s('joinMode'),domain:s('profileDomain'),ouReview:s('profileDomainOu'),domainJoinRunAsId:s('domainJoinRunAsId').toLowerCase(),computerAccessRunAsId:s('computerAccessRunAsId').toLowerCase()},
      localAdminCredentialRef:s('localAdminCredentialRef'), networkAdapterProfileIds:nicIds, networkAdapterReview:s('networkAdapterReview'),
      os:{release:s('os'),installationType:s('installType'),locale:s('locale'),timeZoneId:s('timeZoneId') === '' ? null : Number(s('timeZoneId')),activation:s('activation')},
      storage:{partitionStyle:s('partitionStyle'),diskConfiguration:s('diskConfiguration'),review:s('diskConfigurationEvidence'),vmPaths:paths,bypassVhdConversion:s('vhdConversion') === 'retain' ? true : s('vhdConversion') === 'fixed' ? false : null},
      drivers:{selection:s('driverSelection'),package:s('driverPackage'),matchingTags:tags,hardwareApplicability:s('hardwareApplicability'),artifact:driver ? {id:driver.id,...driver.values} : null},
      fabric:{hostGroupId:s('hostGroupId'),hostGroup:s('hostGroup'),cloud:s('cloud'),delegation:s('delegation'),logicalNetworkId:s('logicalNetworkId')},
      deploymentServices:{wdsServer:s('wdsServer'),registration:s('wdsRegistration'),adkVersion:s('adkVersion'),winpeVersion:s('winpeVersion'),bootDrivers:s('bootDrivers')},
      hostNetworking:{logicalSwitch:s('logicalSwitch'),managementNic:s('managementNic'),vnics:s('vnics'),networkSites:s('networkSites')},
      answerFile:{reference:s('answerFile'),id:s('answerFileId').toLowerCase(),sha256:s('answerFileSha256').toLowerCase()},
      prerequisites:{storage:s('storagePrerequisites'),preflight:s('preflight'),acceptance:s('profileAcceptance')},
      result:{physicalComputerProfileId:null,reviewed:false,executionState:'not-executed'},
    }
  })
  return {kind:'hyperv-vmm-profile-handoff',schemaVersion:1,projectId:project.id,projectRevision:project.revision,
    status:!targets.length?'not-selected':findings.some(f=>f.severity==='error')?'blocked':'design-handoff',automationReady:false,runtimeQualified:false,executionState:'not-executed',
    targets,findings,sources:{reviewedAt:'2026-09-11',urls:VMM_PROFILE_SOURCES},
    steps:[
      'Review this immutable project revision and authorize profile creation on the named VMM service separately from any host deployment.',
      'Check the exact VMM/module versions and name availability. Resolve library disk, NIC profiles and Run As objects by GUID on that service; verify the pinned artifacts and NIC/disk review.',
      'Provide the reviewed profile configuration to the existing VMM implementation process. Keep credentials in the external secret store referenced by the design.',
      'Read back the returned profile GUID and compare image, membership, disk, driver and network settings against this handoff. Attach evidence to the responsible implementation stage.',
      'After review, update this profile record to Use existing profile and enter its returned GUID. Save a new project revision and review the separate bare-metal plan before any host submission.',
    ],limitations:['This is a configuration handoff; profile creation is performed by your existing implementation process.','A new profile has no existing VMM identity. Bare-metal submission stays blocked until the created object is independently reviewed and selected.']}
}
