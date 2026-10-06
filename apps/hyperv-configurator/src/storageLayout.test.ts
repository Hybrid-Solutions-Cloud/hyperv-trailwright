import { describe, it, expect } from 'vitest'
import { storageFixture } from './testing/storageFixture'
import { removeStorageV7 } from './testing/legacyStorage'
import { storagePlacement, volumeFootprint, absoluteStoragePath } from './storageLayout'
import { storagePlan } from './storagePlan'
import { parseProject, serializeProject, newComponent } from './project'
import { environmentFiles, designMarkdown, topology } from './exports'
import { sanitizeProject } from './sanitize'
import { referenceOptions } from './references'

export function placementFixture() {
  const f=storageFixture()
  const workload=f.add('workloads','workload-a',{name:'Example workload',provisionedGiB:200,storageGiB:50})
  const directory=f.add('storagePaths','path-a',{name:'Workload disks',volume:f.fixed.id,path:'C:\\ClusterStorage\\Fixed\\VMs',purpose:'disks',lifecycle:'create'})
  const disk=f.add('storageAllocations','disk-a',{name:'OS disk',resource:workload.id,directory:directory.id,diskKey:'os',sizeGiB:200,usedGiB:50,provisioning:'dynamic'})
  return {...f,workload,directory,disk}
}

describe('structured storage placement',()=>{
  it('reconciles disks within the volume budget without counting capacity twice',()=>{
    const {project}=placementFixture(),plan=storagePlan(project)
    expect(plan.systems.find(s=>s.id==='s2d-a')?.committedTiB).toBe(3)
    expect(plan.placement.volumes.find(v=>v.id==='fixed-a')).toMatchObject({directoryCount:1,allocationCount:1,allocatedGiB:200,usedGiB:50,unallocatedGiB:1848})
    expect(plan.placement.resources[0]).toMatchObject({mappedGiB:200,unmappedGiB:0})
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
  })
  it('rejects duplicate disk keys even when they point at different directories',()=>{
    const {project,disk,add,directory}=placementFixture()
    const other=add('storagePaths','path-b',{...directory.values,path:'C:\\ClusterStorage\\Fixed\\Other'})
    add('storageAllocations','disk-b',{...disk.values,directory:other.id,diskKey:' OS '})
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_ALLOCATION_DUPLICATE')
  })
  it('distinguishes missing, partial and excessive resource coverage',()=>{
    const {project,disk}=placementFixture();disk.values.sizeGiB=100
    expect(storagePlacement(project).resources[0].unmappedGiB).toBe(100)
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_RESOURCE_UNMAPPED')
    disk.values.sizeGiB=201
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_RESOURCE_OVERALLOCATED')
    disk.values.resource='removed'
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_ALLOCATION_REFERENCE')
  })
  it('checks fixed VHDX commitment inside a thin volume',()=>{
    const {project,disk,directory,thin,workload}=placementFixture()
    directory.values.volume=thin.id;directory.values.path=String(thin.values.path)+'\\VMs';workload.values.provisionedGiB=2000
    disk.values.provisioning='fixed';disk.values.sizeGiB=1500
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_DISK_CONSUMPTION')
  })
  it('rejects directory escape, prefix confusion and duplicate normalized paths',()=>{
    const {project,directory,add}=placementFixture()
    for (const path of ['C:\\ClusterStorage\\Fixed\\..\\Other','C:\\ClusterStorage\\Fixed-other\\VMs','relative\\VMs']) {
      directory.values.path=path;expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_DIRECTORY_PATH')
    }
    directory.values.path='C:\\ClusterStorage\\Fixed\\VMs'
    add('storagePaths','path-b',{...directory.values,path:'c:/clusterstorage/fixed/vms/'})
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('STORAGE_DIRECTORY_DUPLICATE')
    expect(absoluteStoragePath('\\\\files.example.test\\share\\VMs')).toBe(true)
    expect(absoluteStoragePath('D:\\')).toBe(true)
    for(const path of ['C:\\VMs:stream','C:\\VMs\\trailing.','C:\\VMs\\*','\\\\?\\C:\\VMs'])expect(absoluteStoragePath(path)).toBe(false)
  })
  it('keeps same local paths on different hosts separate and accepts drive-root volumes',()=>{
    const {project,add,fixed,directory,pool}=placementFixture()
    Object.assign(pool.values,{kind:'local',localHost:'host-1'});Object.assign(fixed.values,{path:'D:\\',resiliency:'external'});directory.values.path='D:\\VMs'
    const other=add('storageSystems','local-b',{kind:'local',cluster:pool.values.cluster,localHost:'host-2',usableTiB:2})
    add('volumes','local-volume',{...fixed.values,system:other.id})
    add('storagePaths','other-path',{...directory.values,volume:'local-volume'})
    const codes=storagePlan(project).findings.map(f=>f.code)
    expect(codes).not.toContain('STORAGE_DIRECTORY_PATH');expect(codes).not.toContain('STORAGE_DIRECTORY_DUPLICATE');expect(codes).not.toContain('VOLUME_PATH_DUPLICATE')
  })
  it('requires a baseline for existing volumes and an explicit plan for conversion or replacement',()=>{
    const {project,fixed}=placementFixture();fixed.values.lifecycle='preserve'
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('VOLUME_CURRENT_STATE')
    Object.assign(fixed.values,{sourceIdentity:'observed-volume',currentSizeGiB:2048,currentResiliency:'mirror3',currentPath:fixed.values.path,currentProvisioning:'fixed'})
    expect(storagePlacement(project).findings.map(f=>f.code)).not.toContain('VOLUME_PRESERVE')
    fixed.values.sizeGiB=4096
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('VOLUME_PRESERVE')
    fixed.values.lifecycle='expand'
    expect(storagePlacement(project).findings.map(f=>f.code)).not.toContain('VOLUME_CONVERSION')
    fixed.values.resiliency='nestedMirror'
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('VOLUME_CONVERSION')
    fixed.values.lifecycle='replace'
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('VOLUME_REPLACEMENT')
  })
  it('counts SAN routes independently and requires real evidence for observed states',()=>{
    const {project,add}=placementFixture()
    const path=add('sanPaths','io-a',{volume:'san-volume',host:'host-1',initiator:'example-init',target:'example-target',fabric:'A',state:'planned'})
    add('sanPaths','io-b',{...path.values,target:'example-target-b',fabric:'B'})
    let plan=storagePlacement(project)
    expect(plan.volumes.find(v=>v.id==='san-volume')).toMatchObject({directoryCount:0,ioPathCount:2})
    expect(plan.findings.filter(f=>f.code==='SAN_PATH_REDUNDANCY')).toHaveLength(2)
    path.values.state='active'
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('SAN_PATH_EVIDENCE')
    path.values.evidence='Reviewed multipath result';path.values.observedAt='2026-09-11T08:00:00Z'
    expect(storagePlacement(project).findings.map(f=>f.code)).not.toContain('SAN_PATH_EVIDENCE')
    add('sanPaths','io-duplicate',{...path.values})
    expect(storagePlacement(project).findings.map(f=>f.code)).toContain('SAN_PATH_DUPLICATE')
    path.values.state='failed';path.values.volume='fixed-a'
    expect(storagePlacement(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['SAN_PATH_FAILED','SAN_PATH_TARGET']))
  })
  it('offers only capacity-owning resources and retains references when sanitizing',()=>{
    const {project}=placementFixture(),c=newComponent('vmm');c.hosting='external';project.components.push(c)
    expect(referenceOptions(project,'$storageConsumers').map(r=>r.id)).toEqual(['workload-a'])
    const shared=parseProject(serializeProject(sanitizeProject(project)))
    expect(shared.design.storageAllocations[0].values.resource).toBe(shared.design.workloads[0].id)
    expect(shared.design.storageAllocations[0].values.directory).toBe(shared.design.storagePaths[0].id)
    expect(shared.design.storagePaths[0].values.volume).toBe(shared.design.volumes[0].id)
  })
  it('exports placement, directories and topology from the same model',()=>{
    const {project}=placementFixture(),files=environmentFiles(project)
    expect(files['environment/storage.yml']).toContain('storageAllocations:')
    expect(JSON.parse(files['plans/storage-assessment.json']).placement.resources[0].mappedGiB).toBe(200)
    expect(designMarkdown(project)).toContain('| Example workload | 200 | 200 | 0 |')
    expect(topology(project).drawio).toContain('source="n:workload-a" target="n:disk-a"')
    const before=serializeProject(project);storagePlacement(project);expect(serializeProject(project)).toBe(before)
  })
})

describe('reviewed resiliency layouts',()=>{
  it('uses four copies for nested mirror only on two nodes',()=>{
    const {fixed}=storageFixture();fixed.values.resiliency='nestedMirror'
    expect(volumeFootprint(fixed.values,2,[])).toMatchObject({fullTiB:8,committedTiB:8})
    expect(volumeFootprint(fixed.values,3,[]).fullTiB).toBeNull()
  })
  it('matches the documented six-drive 10/90 nested example and keeps thin tier usage unknown',()=>{
    const {fixed}=storageFixture()
    Object.assign(fixed.values,{resiliency:'nestedMap',sizeGiB:100,mirrorTierGiB:10,parityTierGiB:90,parityColumns:6,parityMedia:'ssd',layoutEvidence:'Reviewed nested tier metadata'})
    const drives=[{host:'one',media:'ssd',count:6},{host:'two',media:'ssd',count:6}]
    expect(volumeFootprint(fixed.values,2,drives)).toMatchObject({fullTiB:256/1024,committedTiB:256/1024,findings:[]})
    fixed.values.provisioning='thin'
    expect(volumeFootprint(fixed.values,2,drives)).toMatchObject({fullTiB:256/1024,committedTiB:null})
    drives[1].count=5
    expect(volumeFootprint(fixed.values,2,drives).fullTiB).toBeNull()
  })
  it('checks parity encoding scale/media and exact tier size totals',()=>{
    const {fixed}=storageFixture(),drives=[{host:'one',media:'ssd',count:4}]
    Object.assign(fixed.values,{resiliency:'parity',parityLayout:'rs4',parityMedia:'ssd',layoutEvidence:'Reviewed tier metadata'})
    expect(volumeFootprint(fixed.values,7,drives).fullTiB).toBe(3)
    expect(volumeFootprint(fixed.values,6,drives).fullTiB).toBeNull()
    fixed.values.parityLayout='lrc8'
    expect(volumeFootprint(fixed.values,12,drives).fullTiB).toBeNull()
    Object.assign(fixed.values,{resiliency:'map',parityLayout:'rs2',mirrorTierGiB:1024,parityTierGiB:1024})
    expect(volumeFootprint(fixed.values,4,drives).fullTiB).toBe(5)
    fixed.values.mirrorTierGiB=512
    expect(volumeFootprint(fixed.values,4,drives).fullTiB).toBeNull()
  })
})

describe('schema 7 storage migration',()=>{
  it('preserves legacy answers while requiring explicit lifecycle and placement',()=>{
    const {project}=storageFixture(),legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=6
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 6')
    removeStorageV7(legacy)
    const migrated=parseProject(JSON.stringify(legacy))
    expect(migrated.schemaVersion).toBe(32);expect(migrated.id).toBe(project.id);expect(migrated.revision).toBe(project.revision)
    expect(migrated.design.storagePaths).toEqual([])
    expect(migrated.design.volumes[0].values).toMatchObject({lifecycle:'',sourceIdentity:'',currentSizeGiB:0,path:project.design.volumes[0].values.path,sizeGiB:2048})
    expect(storagePlan(migrated).findings.map(f=>f.code)).toContain('VOLUME_LIFECYCLE')
  })
  it('rejects smuggled new storage fields and missing current collections',()=>{
    const {project}=storageFixture(),legacy=JSON.parse(serializeProject(project));legacy.schemaVersion=6;removeStorageV7(legacy)
    legacy.design.volumes[0].values.lifecycle='replace'
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 6')
    const current=JSON.parse(serializeProject(project));delete current.design.storageAllocations
    expect(()=>parseProject(JSON.stringify(current))).toThrow('inventory')
  })
})
