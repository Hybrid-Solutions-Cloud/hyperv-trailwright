import { describe, it, expect } from 'vitest'
import { load } from 'js-yaml'
import { storagePlan, storageSchedule } from './storagePlan'
import { storageFixture } from './testing/storageFixture'
import { environmentFiles, designMarkdown } from './exports'
import { parseProject, serializeProject } from './project'
import { validate } from './validation'

describe('storage allocation and handoff',()=>{
  it('separates logical commitment, thin growth and raw mirror footprint by backend',()=>{
    const {project}=storageFixture(),plan=storagePlan(project)
    expect(plan.systems.find(s=>s.id==='s2d-a')).toMatchObject({volumeCount:2,csvCount:2,fixedCount:1,thinCount:1,logicalTiB:10,consumedTiB:1.5,committedTiB:3,availableTiB:7,headroomTiB:4,fullGrowthHeadroomTiB:-3,inventoryRawTiB:24,repairReserveTiB:6,rawCommittedTiB:9,rawFullTiB:30,rawHeadroomTiB:9})
    expect(plan.systems.find(s=>s.id==='san-a')).toMatchObject({committedTiB:4,headroomTiB:6,rawCommittedTiB:null,inventoryRawTiB:null})
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
    expect(plan.findings.some(f=>f.code==='THIN_FULL_GROWTH')).toBe(true)
  })
  it('catches fixed over-allocation even when expected data usage is low',()=>{
    const {project,fixed}=storageFixture();fixed.values.sizeGiB=8*1024
    expect(validate(project).some(f=>f.code==='STORAGE_CAPACITY')).toBe(true)
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_RAW_FOOTPRINT')).toBe(true)
  })
  it('does not call unspecified provisioning a zero or thin commitment',()=>{
    const {project,fixed}=storageFixture();fixed.values.provisioning=''
    expect(storagePlan(project).systems.find(s=>s.id==='s2d-a')).toMatchObject({committedTiB:null,headroomTiB:null,rawCommittedTiB:null,rawHeadroomTiB:null})
    expect(storageSchedule(project).find(s=>s.Backend==='Example S2D')?.CommittedTiB).toBe('Unknown')
  })
  it('reports consumption and reserve exceeding their limits',()=>{
    const {project,pool,fixed}=storageFixture();fixed.values.usedGiB=4096;pool.values.reserveTiB=9
    const codes=storagePlan(project).findings.map(f=>f.code)
    expect(codes).toContain('VOLUME_CONSUMPTION');expect(codes).toContain('STORAGE_RESERVE')
  })
  it('keeps parity footprint unknown without guessed efficiency',()=>{
    const {project,thin}=storageFixture();thin.values.resiliency='map'
    const plan=storagePlan(project)
    expect(plan.systems.find(s=>s.id==='s2d-a')).toMatchObject({rawCommittedTiB:null,rawFullTiB:null,rawHeadroomTiB:null})
    expect(plan.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['S2D_RESILIENCY_NODES','S2D_TIER_REVIEW']))
  })
  it('requires three nodes for three-way mirror and four for ordinary parity',()=>{
    const {project}=storageFixture();project.design.hosts.pop()
    expect(storagePlan(project).findings.filter(f=>f.code==='S2D_RESILIENCY_NODES')).toHaveLength(2)
  })
  it('excludes boot/cache capacity and rejects raw capacity above drive inventory',()=>{
    const {project,pool}=storageFixture();pool.values.rawTiB=25
    expect(storagePlan(project).systems.find(s=>s.id==='s2d-a')?.inventoryRawTiB).toBe(24)
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_RAW_INVENTORY')).toBe(true)
  })
  it('preserves unknown physical headroom for missing drive inventory',()=>{
    const {project}=storageFixture();project.design.disks=project.design.disks.filter(d=>d.id!=='capacity-3')
    expect(storagePlan(project).systems.find(s=>s.id==='s2d-a')).toMatchObject({inventoryRawTiB:null,repairReserveTiB:null,rawHeadroomTiB:null})
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_DRIVE_INVENTORY')).toBe(true)
  })
  it('requires valid integer drive groups and appropriate physical cache',()=>{
    const {project}=storageFixture();project.design.disks.find(d=>d.id==='capacity-1')!.values.count=0.5
    const cache=project.design.disks.find(d=>d.id==='cache-1')!;cache.values.count=1;cache.values.media='hdd'
    expect(storagePlan(project).findings.map(f=>f.code)).toEqual(expect.arrayContaining(['DRIVE_QUANTITY','S2D_CACHE_DRIVES','S2D_CACHE_MEDIA']))
  })
  it('permits cacheless all-flash but requires cache for HDD capacity',()=>{
    const {project}=storageFixture();project.design.disks=project.design.disks.filter(d=>d.values.role!=='cache')
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_CACHE_DRIVES')).toBe(false)
    project.design.disks.find(d=>d.id==='capacity-1')!.values.media='hdd'
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_CACHE_DRIVES')).toBe(true)
  })
  it('compares grouped drive layouts, independent of row splitting',()=>{
    const {project,add}=storageFixture();project.design.disks.find(d=>d.id==='capacity-1')!.values.count=2
    add('disks','capacity-extra',{host:'host-1',role:'capacity',media:'ssd',count:2,sizeGiB:2048})
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_DRIVE_SYMMETRY')).toBe(false)
    project.design.disks.find(d=>d.id==='capacity-extra')!.values.sizeGiB=1024
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_DRIVE_SYMMETRY')).toBe(true)
  })
  it('does not reuse the same physical drives across duplicate S2D systems',()=>{
    const {project,pool}=storageFixture();project.design.storageSystems.push({...structuredClone(pool),id:'duplicate'})
    const plan=storagePlan(project)
    expect(plan.findings.filter(f=>f.code==='S2D_POOL_OWNERSHIP')).toHaveLength(2)
    expect(plan.systems.filter(s=>s.kind==='s2d').every(s=>s.inventoryRawTiB===null)).toBe(true)
  })
  it('validates physical S2D edition and node count without imposing Azure Local limits',()=>{
    const {project,cluster,add}=storageFixture();cluster.values.edition='standard'
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_PLATFORM')).toBe(true)
    for(let i=4;i<=17;i++)add('hosts',`host-${i}`,{cluster:cluster.id})
    expect(storagePlan(project).findings.some(f=>f.code==='S2D_NODES')).toBe(true)
  })
  it('scopes duplicate paths to a cluster and LUN IDs to a backend',()=>{
    const {project,fixed,add,cluster}=storageFixture()
    const volume=project.design.volumes.find(v=>v.id==='san-volume')!;volume.values.path='c:/clusterstorage/FIXED/'
    expect(storagePlan(project).findings.some(f=>f.code==='VOLUME_PATH_DUPLICATE')).toBe(true)
    const other=add('storageSystems','other-san',{cluster:cluster.id,kind:'fc',usableTiB:10})
    add('volumes','other-lun',{system:other.id,lunId:volume.values.lunId,path:'C:\\ClusterStorage\\Other',sizeGiB:1})
    expect(storagePlan(project).findings.some(f=>f.code==='SAN_LUN_DUPLICATE')).toBe(false)
    add('volumes','duplicate-lun',{system:'san-a',lunId:volume.values.lunId,path:'C:\\ClusterStorage\\Another',sizeGiB:1})
    expect(storagePlan(project).findings.some(f=>f.code==='SAN_LUN_DUPLICATE')).toBe(true)
    fixed.values.path='C:\\ClusterStorage\\Unique'
    expect(storagePlan(project).findings.some(f=>f.code==='VOLUME_PATH_DUPLICATE')).toBe(false)
  })
  it('requires SAN presentation details and keeps ReFS SAN guidance a review',()=>{
    const {project,san}=storageFixture();san.values.mpio='';project.design.volumes.find(v=>v.id==='san-volume')!.values.filesystem='refs'
    const findings=storagePlan(project).findings
    expect(findings.some(f=>f.code==='SAN_PRESENTATION'&&f.severity==='error')).toBe(true)
    expect(findings.some(f=>f.code==='SAN_CSV_FILESYSTEM'&&f.severity==='warning')).toBe(true)
  })
  it('keeps SMB share allocation separate from block CSV semantics',()=>{
    const {project,san}=storageFixture();san.values.kind='smb';san.values.permissions='Reviewed share and transport'
    const volume=project.design.volumes.find(v=>v.id==='san-volume')!;volume.values.path='\\\\files.example.test\\workloads';volume.values.filesystem='external'
    expect(storagePlan(project).findings.some(f=>f.code==='SMB_VOLUME')).toBe(false)
    volume.values.path='C:\\ClusterStorage\\Invalid'
    expect(storagePlan(project).findings.some(f=>f.code==='SMB_VOLUME')).toBe(true)
    san.values.kind='local'
    expect(storagePlan(project).findings.some(f=>f.code==='LOCAL_CSV')).toBe(true)
  })
  it('round-trips owned data and emits reproducible assessments without mutation',()=>{
    const {project}=storageFixture(),before=serializeProject(project),reopened=parseProject(before)
    const files=environmentFiles(project),plan=storagePlan(project)
    expect(JSON.parse(files['plans/storage-assessment.json'])).toEqual(plan)
    expect(load(files['environment/storage.yml'])).toHaveProperty('volumes')
    expect(files['reports/storage.md']).toContain('Committed logical demand | 3 TiB')
    expect(designMarkdown(project)).toContain('Physical repair allowance | 6 TiB')
    expect(storagePlan(reopened)).toEqual(plan)
    expect(plan).toMatchObject({automationReady:false,executionState:'not-executed'})
    expect(serializeProject(project)).toBe(before)
    project.design.storageSystems.reverse();project.design.volumes.reverse();project.design.disks.reverse()
    expect(storagePlan(project)).toEqual(plan)
  })
})
