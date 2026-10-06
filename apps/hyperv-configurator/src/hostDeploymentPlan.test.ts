import {describe,it,expect} from 'vitest'
import {collections,newRecord,visibleField,type Answers} from './catalog'
import {recordFields} from './availabilityDetailFields'
import {parseProject,serializeProject,newComponent} from './project'
import {hostDeploymentPlan,hostDeploymentSchedule} from './hostDeploymentPlan'
import {clusterFixture} from './testing/clusterFixture'
import {vmmFixture} from './testing/vmmFixture'
import {removeHostDeploymentV19} from './testing/legacyHostDeployment'
import {environmentFiles,hostDeploymentMarkdown,topology} from './exports'
import {sanitizeProject} from './sanitize'
import {validate} from './validation'
import {reviewTarget} from './review'
import {mkdirSync,writeFileSync} from 'node:fs'
const now=Date.parse('2026-09-11T18:00:00Z')
type Project=ReturnType<typeof clusterFixture>['project']
const codes=(p:Project)=>hostDeploymentPlan(p,now).findings.map(f=>f.code)
function row(p:Project,key:string,values:Answers){const r=newRecord(collections.find(c=>c.key===key)!);Object.assign(r.values,values);p.design[key].push(r);return r}

describe('per-host deployment scope',()=>{
  it('makes existing profile readback editable without exposing creation actions',()=>{
    const {project,profile}=vmmFixture(),collection=collections.find(c=>c.key==='profiles')!
    const fields=recordFields(project,collection,profile.values).filter(f=>visibleField(f,profile.values))
    for(const key of ['partitionStyle','profileDomain','diskConfiguration','networkAdapterProfileIds','driverArtifact'])expect(fields.find(f=>f.key===key)?.required).toBe(false)
    expect(fields.some(f=>f.key==='vhdConversion')).toBe(false)
  })
  it('retains mixed expansion observations without converting preserved members into new admissions',()=>{
    const {project,cluster,nodes}=clusterFixture()
    Object.assign(cluster.values,{lifecycle:'expand',startingState:'mixed',existingClusterId:'native-cluster',existingClusterEvidence:'Reviewed member inventory'})
    Object.assign(nodes[0].values,{lifecycle:'preserve',currentState:'member',currentClusterId:'native-cluster',clusterAction:'preserve',clusterJoinOwner:'preserve'})
    const plan=hostDeploymentPlan(project,now)
    expect(plan.clusters[0].observedStates).toEqual(['member','ready'])
    expect(plan.hosts.map(h=>h.changing)).toEqual([false,true])
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
    cluster.values.startingState='ready';expect(codes(project)).toContain('CLUSTER_MIXED_STATE')
    nodes[1].values.clusterAction='none';expect(codes(project)).toContain('CLUSTER_EXPANSION_MEMBERS')
  })
  it('requires explicit replacement lifecycle, previous identity, evacuation, scope and window',()=>{
    const {project,nodes}=clusterFixture(),h=nodes[0]
    Object.assign(h.values,{osAction:'reimage',osOwner:'provider',hostRoleAction:'enable',hostRoleOwner:'native'})
    expect(codes(project)).toEqual(expect.arrayContaining(['HOST_REPLACEMENT_EVIDENCE','HOST_REPLACEMENT_LIFECYCLE']))
    Object.assign(h.values,{lifecycle:'replace',previousMachineId:'EXAMPLE old serial',evacuationEvidence:'Reviewed workload and data preservation',reimageScope:'Approved OS disk replacement only',changeWindow:'EXAMPLE scheduled window'})
    expect(codes(project)).not.toEqual(expect.arrayContaining(['HOST_REPLACEMENT_EVIDENCE','HOST_REPLACEMENT_LIFECYCLE']))
    expect(hostDeploymentPlan(project,now).hosts[0]).toMatchObject({replacement:true,runtimeQualified:false})
  })
  it('rejects preserve/adopt conflicts and unavailable OS or role preservation',()=>{
    const {project,host}=vmmFixture();host.values.lifecycle='preserve';expect(codes(project)).toContain('HOST_PRESERVE_ACTION')
    host.values.lifecycle='adopt';expect(codes(project)).toContain('HOST_PRESERVE_ACTION')
    Object.assign(host.values,{osAction:'preserve',osOwner:'preserve',hostRoleAction:'preserve',hostRoleOwner:'preserve'})
    expect(codes(project)).toEqual(expect.arrayContaining(['HOST_NO_OS','HOST_ROLE_UNAVAILABLE']))
    Object.assign(host.values,{currentState:'ready',osAction:'install'});expect(codes(project)).toContain('HOST_INSTALL_STATE')
  })
  it('separates membership identity, target preservation and standalone intent',()=>{
    const {project,cluster,nodes}=clusterFixture(),h=nodes[0]
    Object.assign(cluster.values,{startingState:'mixed',existingClusterId:'native-target',lifecycle:'expand'})
    Object.assign(h.values,{currentState:'member',currentClusterId:'native-other'})
    expect(codes(project)).toContain('HOST_FOREIGN_CLUSTER')
    h.values.currentClusterId='NATIVE-TARGET';expect(codes(project)).toContain('HOST_ALREADY_MEMBER')
    cluster.values.lifecycle='preserve';expect(codes(project)).toContain('HOST_CLUSTER_PRESERVE')
    cluster.values.topology='standalone';expect(codes(project)).toContain('HOST_STANDALONE_JOIN')
    Object.assign(h.values,{currentState:'ready',clusterAction:'preserve',clusterJoinOwner:'preserve'});expect(codes(project)).toContain('HOST_MEMBERSHIP_STATE')
  })
  it('requires matching action owners and current observations in exported candidates',()=>{
    const v=vmmFixture();
    v.host.values.osOwner='preserve';expect(codes(v.project)).toContain('HOST_ACTION_OWNER');
  })
  it('distinguishes unknown hardware from an observed missing capability',()=>{
    const {project,host}=vmmFixture();host.values.slat='unknown'
    expect(hostDeploymentPlan(project,now).findings.find(f=>f.fieldKey==='slat')).toMatchObject({severity:'warning'})
    host.values.slat='no';expect(hostDeploymentPlan(project,now).findings.find(f=>f.fieldKey==='slat')).toMatchObject({severity:'error'})

    Object.assign(host.values,{secureBoot:true,boot:'bios',uuid:'00000000-0000-0000-0000-000000000000',sockets:1.5})
    expect(codes(project)).toEqual(expect.arrayContaining(['HOST_SECURE_BOOT','HOST_UUID','HOST_CPU_COUNT']))
  })
  it('correlates physical site, duplicate identities and the owning boot disk',()=>{
    const {project,cluster,nodes}=clusterFixture();nodes[0].values.site='other-site';nodes[1].values.uuid=nodes[0].values.uuid
    const disk=row(project,'disks',{name:'Other host boot disk',host:nodes[1].id,role:'boot'});nodes[0].values.bootDiskRecord=disk.id
    expect(codes(project)).toEqual(expect.arrayContaining(['HOST_CLUSTER_SITE','HOST_IDENTITY_DUPLICATE','HOST_BOOT_DISK']))
    cluster.values.topology='multisite';nodes[1].values.uuid='22222222-2222-2222-2222-222222222222';disk.values.host=nodes[0].id
    expect(codes(project)).not.toEqual(expect.arrayContaining(['HOST_CLUSTER_SITE','HOST_IDENTITY_DUPLICATE','HOST_BOOT_DISK']))
  })
  it('checks physical PXE ownership and firmware/partition/profile OS compatibility',()=>{
    const {project,host,profile,adapter}=vmmFixture()
    Object.assign(host.values,{pxeAdapter:adapter.id,pxeMac:'02-00-00-00-00-01',boot:'uefi'})
    Object.assign(profile.values,{profileFirmware:'bios',partitionStyle:'mbr',os:'ws2022'});project.design.clusters[0].values.os='ws2025'
    expect(codes(project)).toEqual(expect.arrayContaining(['HOST_PROFILE_BOOT','HOST_PROFILE_FIRMWARE','HOST_PROFILE_OS']))
    expect(codes(project)).not.toContain('HOST_PXE_ADAPTER')
    adapter.values.host='different-host';expect(codes(project)).toContain('HOST_PXE_ADAPTER')
  })
  it('checks reviewed PXE service/subnet, image type and ordinary VMM domain suffix',()=>{
    const {project,host,profile,adapter}=vmmFixture(),pxe=newComponent('pxe');project.components.push(pxe)
    const net=row(project,'networks',{cidr:'198.51.100.0/24',routingScope:'example'}),media=row(project,'media',{kind:'iso'})
    Object.assign(host.values,{pxeAdapter:adapter.id,pxeMac:String(adapter.values.mac)})
    Object.assign(profile.values,{pxeService:pxe.id,pxeNetwork:net.id,image:media.id,profileDomain:'other.test'})
    expect(codes(project)).toEqual(expect.arrayContaining(['PROFILE_PXE_SUBNET','HOST_VMM_IMAGE','HOST_VMM_NAMESPACE']))
    Object.assign(net.values,{cidr:'192.0.2.0/24'});media.values.kind='vhdx';profile.values.profileDomain='example.test'
    expect(codes(project)).not.toEqual(expect.arrayContaining(['PROFILE_PXE_SERVICE','PROFILE_PXE_SUBNET','HOST_VMM_IMAGE','HOST_VMM_NAMESPACE']))
    profile.values.pxeService='missing';expect(codes(project)).toContain('PROFILE_PXE_SERVICE')
    profile.values.profileObservedAt='2026-02-31T00:00:00Z';expect(codes(project)).toContain('PROFILE_OBSERVATION_TIME')
  })
  it('scopes access point and migration review without treating all clustered CredSSP as unsupported',()=>{
    const {project,cluster}=clusterFixture(),identity=row(project,'identities',{kind:'pki'})
    Object.assign(cluster.values,{directoryIdentity:identity.id,migrationAuthentication:'credssp',migrationTransport:'smb',migrationConcurrency:1.5})
    expect(codes(project)).toEqual(expect.arrayContaining(['CLUSTER_DIRECTORY','MIGRATION_CONCURRENCY']))
    expect(hostDeploymentPlan(project,now).findings.find(f=>f.code==='MIGRATION_CREDENTIAL_GUARD')?.severity).toBe('warning')
    cluster.values.topology='standalone';expect(hostDeploymentPlan(project,now).findings.find(f=>f.code==='MIGRATION_CREDENTIAL_GUARD')?.severity).toBe('error')
  })
  it('migrates schema18 without inferring host state, stage ownership or observations',()=>{
    const {project}=vmmFixture(),old:any=structuredClone(project);old.schemaVersion=18
    expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 18')
    removeHostDeploymentV19(old);const migrated=parseProject(JSON.stringify(old))
    expect(migrated.schemaVersion).toBe(32);expect(migrated.design.hosts[0].values).toMatchObject({currentState:'',osAction:'',osOwner:'',inventoryObservedAt:'',site:''})
    old.design.clusters[0].values.startingState='mixed';expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 18')
  })
  it('retains deployment inputs across save/open, machine plans, worksheets and linked topology',()=>{
    const {project,host,adapter}=vmmFixture();Object.assign(host.values,{pxeAdapter:adapter.id,pxeMac:String(adapter.values.mac),inventoryEvidence:'EXAMPLE reviewed physical observation'})
    const roundtrip=parseProject(serializeProject(project));expect(roundtrip.design.hosts[0]).toEqual(host)
    const files=environmentFiles(roundtrip),plan=JSON.parse(files['plans/host-deployment.json'])
    expect(plan.hosts[0]).toMatchObject({runtimeQualified:false,inputs:{osAction:'install',osOwner:'vmm',inventoryEvidence:'EXAMPLE reviewed physical observation'}})
    expect(hostDeploymentSchedule(roundtrip)[0]).toMatchObject({ObservedState:'baremetal',OsOwner:'vmm',RuntimeQualified:'No'})
    expect(hostDeploymentMarkdown(roundtrip)).toContain('install / vmm')
    expect(topology(roundtrip).drawio).toContain('source="n:'+adapter.id+'" target="n:'+host.id+'"')
    host.values.osOwner='preserve';expect(hostDeploymentPlan(project).findings.some(f=>f.code==='HOST_ACTION_OWNER')).toBe(true)
  })
  it('redacts observations and native identities while preserving selected actions and resource references',()=>{
    const {project,host,adapter}=vmmFixture();Object.assign(host.values,{pxeAdapter:adapter.id,previousMachineId:'PRIVATE old serial',inventoryEvidence:'PRIVATE inventory evidence'})
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(shared.design.hosts[0].values).toMatchObject({pxeAdapter:shared.design.adapters[0].id,osAction:'install',osOwner:'vmm'})
    expect(JSON.stringify(shared)).not.toContain('PRIVATE')
  })
  it('shows each adapter-shared deployment finding once and resolves its owning field',()=>{
    const {project,host}=vmmFixture();host.values.osOwner='preserve'
    const findings=validate(project).filter(f=>f.code==='HOST_ACTION_OWNER'&&f.recordId===host.id)
    expect(findings).toHaveLength(1)
    expect(reviewTarget(project,findings[0])).toEqual({section:'hardware',recordId:host.id,fieldKey:'osOwner'})
  })
})
