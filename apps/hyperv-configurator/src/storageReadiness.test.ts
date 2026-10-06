import {describe,it,expect} from 'vitest'
import {storageFixture} from './testing/storageFixture'
import {storageReadiness} from './storageReadiness'
import {storagePlan} from './storagePlan'
import {parseProject,serializeProject} from './project'
import {removeStorageReadinessV20} from './testing/legacyStorageReadiness'
import {environmentFiles,topology} from './exports'
import {sanitizeProject} from './sanitize'
import {clusterFixture} from './testing/clusterFixture'
import {hostDeploymentPlan} from './hostDeploymentPlan'
const now=Date.parse('2026-09-11T18:00:00Z')
const codes=(p:ReturnType<typeof storageFixture>['project'])=>storageReadiness(p,now).findings.map(f=>f.code)

describe('physical storage and SAN readiness',()=>{
  it('keeps decimal hardware limits and additional cache metadata memory distinct from GiB/TiB inputs',()=>{
    const {project,pool}=storageFixture();project.design.hosts[0].values.memoryGiB=1
    const baseline=storageReadiness(project,now).systems.find(s=>s.id===pool.id)!
    expect(baseline.cacheMemory[0].metadataGB).toBeCloseTo(4.398046511104)
    expect(codes(project)).toContain('S2D_CACHE_MEMORY')
    project.design.hosts[0].values.memoryGiB=128;project.design.disks.find(d=>d.id==='capacity-1')!.values.sizeGiB=100000;pool.values.rawTiB=4000
    expect(codes(project)).toEqual(expect.arrayContaining(['S2D_NODE_CAPACITY_LIMIT','S2D_POOL_CAPACITY_LIMIT']))
    expect(codes(project)).not.toContain('S2D_CACHE_MEMORY')
  })
  it('keeps local-only resource attachments on the owning host and shared attachments in the backend cluster',()=>{
    const {project,add}=storageFixture(),local=add('storageSystems','local-a',{kind:'local',cluster:'cluster-a',localHost:'host-1'}),volume=add('volumes','local-vol',{system:local.id,path:'D:\\VMs'}),dir=add('storagePaths','local-dir',{volume:volume.id,path:'D:\\VMs\\One',purpose:'disks'}),disk=add('storageAllocations','attachment-a',{directory:dir.id,attachmentMode:'host',accessHost:'host-2'})
    expect(codes(project)).toContain('STORAGE_LOCAL_ATTACHMENT')
    disk.values.accessHost='host-1';expect(codes(project)).not.toContain('STORAGE_LOCAL_ATTACHMENT')
    disk.values.attachmentMode='cluster';disk.values.accessCluster='foreign-cluster';expect(codes(project)).toEqual(expect.arrayContaining(['STORAGE_LOCAL_ATTACHMENT','STORAGE_ATTACHMENT_CLUSTER']))
    disk.values.attachmentMode='host';disk.values.accessHost='missing';expect(codes(project)).toContain('STORAGE_ATTACHMENT_HOST')
  })
  it('keeps unknown device eligibility under review without claiming native qualification',()=>{
    const {project}=storageFixture(),plan=storageReadiness(project,now)
    expect(plan.disks.find(d=>d.id==='capacity-1')).toMatchObject({status:'review-required',runtimeQualified:false})
    expect(plan.disks.find(d=>d.id==='boot-1')?.status).toBe('not-pool-device')
    expect(plan.findings.filter(f=>f.severity==='error')).toEqual([])
    expect(storagePlan(project).systems.find(s=>s.kind==='s2d')?.inventoryRawTiB).toBe(24)
  })
  it.each(['fc','iscsi','sharedSas','virtual'])('excludes incompatible %s physical pool devices from available inventory',(bus)=>{
    const {project}=storageFixture();project.design.disks.find(d=>d.id==='capacity-1')!.values.bus=bus
    expect(codes(project)).toContain('S2D_DEVICE_CONNECTION')
    expect(storagePlan(project).systems.find(s=>s.kind==='s2d')).toMatchObject({inventoryRawTiB:null,rawHeadroomTiB:null})
  })
  it('checks cache devices as well as capacity and permits a separate mirrored boot disk',()=>{
    const {project}=storageFixture();project.design.disks.find(d=>d.id==='boot-1')!.values.presentation='raid'
    expect(codes(project)).not.toContain('S2D_DEVICE_PRESENTATION')
    project.design.disks.find(d=>d.id==='cache-1')!.values.presentation='raid'
    expect(storagePlan(project).systems.find(s=>s.kind==='s2d')?.inventoryRawTiB).toBeNull()
  })
  it('rejects shared/multipath pool devices and missing flash protection',()=>{
    const {project}=storageFixture(),d=project.design.disks.find(d=>d.id==='capacity-1')!
    Object.assign(d.values,{sharedAccess:'yes',multipath:'yes',powerLossProtection:'no'})
    expect(codes(project)).toEqual(expect.arrayContaining(['S2D_DEVICE_SHARING','S2D_FLASH_PROTECTION']))
    Object.assign(d.values,{bus:'sata',presentation:'direct',sharedAccess:'no',multipath:'no',powerLossProtection:'yes',nativeDiskIds:'EXAMPLE device serials',driverVersion:'EXAMPLE approved driver',certification:'EXAMPLE vendor and OS review',observedAt:'2026-09-11T12:00:00Z',evidence:'EXAMPLE direct physical inventory'})
    expect(storageReadiness(project,now).disks.find(x=>x.id===d.id)).toMatchObject({status:'operator-reviewed',runtimeQualified:false})
  })
  it('requires native baseline and explicit replacement scope without changing preserved backends',()=>{
    const {project,pool}=storageFixture();Object.assign(pool.values,{storageAction:'preserve',storageOwner:'native'})
    expect(codes(project)).toContain('STORAGE_BACKEND_OWNER')
    Object.assign(pool.values,{storageAction:'replace',replacementScope:'',storageChangeWindow:''})
    expect(codes(project)).toContain('STORAGE_BACKEND_REPLACEMENT')
    Object.assign(pool.values,{replacementScope:'EXAMPLE backup, migration and approval',storageChangeWindow:'EXAMPLE scheduled window',nativeStorageId:'EXAMPLE old pool',baselineEvidence:'EXAMPLE member and disk readback'})
    expect(codes(project)).not.toContain('STORAGE_BACKEND_REPLACEMENT')
    pool.values.storageAction='create';expect(codes(project)).toContain('STORAGE_BACKEND_EXISTING')
  })
  it('correlates FC initiator/target identity, host and backend protocol',()=>{
    const {project,add}=storageFixture(),port=add('storageInterfaces','port-a',{host:'host-1',protocol:'fc',nativeId:'HBA-A/port1',initiator:'20:00:00:00:00:00:00:01',fabric:'A'})
    const route=add('sanPaths','route-a',{host:'host-1',volume:'san-volume',interface:port.id,initiator:'2000000000000001',target:'50:00:00:00:00:00:00:01',fabric:'A',state:'planned'})
    expect(codes(project)).not.toEqual(expect.arrayContaining(['SAN_WWPN','SAN_TARGET_WWPN','SAN_ROUTE_INITIATOR','SAN_ROUTE_INTERFACE']))
    route.values.initiator='2000000000000002';route.values.host='host-2'
    expect(codes(project)).toEqual(expect.arrayContaining(['SAN_ROUTE_INITIATOR','SAN_ROUTE_INTERFACE']))
    route.values.target='bad-target';port.values.initiator='0000000000000000';expect(codes(project)).toEqual(expect.arrayContaining(['SAN_WWPN','SAN_TARGET_WWPN']))
  })
  it('does not treat different fabric labels through one physical port as independent routes',()=>{
    const {project,add}=storageFixture(),port=add('storageInterfaces','port-a',{host:'host-1',protocol:'fc',nativeId:'HBA-A/port1',initiator:'2000000000000001',fabric:'physical-A'})
    const values={host:'host-1',volume:'san-volume',interface:port.id,initiator:'2000000000000001',target:'5000000000000001',fabric:'label-A',state:'planned'}
    add('sanPaths','route-a',values);const route=add('sanPaths','route-b',{...values,target:'5000000000000002',fabric:'label-B'})
    expect(codes(project)).toContain('SAN_PHYSICAL_DIVERSITY')
    const other=add('storageInterfaces','port-b',{...port.values,nativeId:'HBA-B/port1',initiator:'2000000000000002',fabric:'physical-B'})
    Object.assign(route.values,{interface:other.id,initiator:other.values.initiator})
    expect(codes(project)).not.toContain('SAN_PHYSICAL_DIVERSITY')
    other.values.nativeId=port.values.nativeId;expect(codes(project)).toContain('SAN_INTERFACE_DUPLICATE')
  })
  it('checks iSCSI Ethernet ownership and transport network without forcing FC ports into NIC inventory',()=>{
    const {project,add,san}=storageFixture();san.values.kind='iscsi'
    add('networks','storage-a',{purpose:'storage',cidr:'192.0.2.0/24'});add('adapters','nic-a',{host:'host-1',network:'storage-a'})
    const port=add('storageInterfaces','port-a',{host:'host-1',protocol:'iscsi',nativeId:'EXAMPLE iscsi port',initiator:'iqn.2026-09.test.example:host1',adapter:'nic-a',network:'storage-a'})
    const route=add('sanPaths','route-a',{host:'host-1',volume:'san-volume',interface:port.id,initiator:port.values.initiator,network:'storage-a',target:'192.0.2.10:3260',fabric:'storage-a',state:'planned'})
    expect(codes(project)).not.toEqual(expect.arrayContaining(['SAN_INTERFACE_ADAPTER','SAN_INTERFACE_NETWORK','SAN_ROUTE_INTERFACE','SAN_ROUTE_NETWORK']))
    route.values.network='storage-b';port.values.host='host-2';expect(codes(project)).toEqual(expect.arrayContaining(['SAN_INTERFACE_ADAPTER','SAN_ROUTE_NETWORK']))
  })
  it('rejects impossible and future UTC observations across devices, interfaces and SAN routes',()=>{
    const {project,add}=storageFixture();project.design.disks[0].values.observedAt='2026-02-31T00:00:00Z'
    add('storageInterfaces','port-a',{observedAt:'2099-01-01T00:00:00Z'});add('sanPaths','route-a',{observedAt:'not a date'})
    expect(storageReadiness(project,now).findings.filter(f=>f.code==='STORAGE_OBSERVATION_TIME')).toHaveLength(3)
  })
  it('migrates schema19 without fabricating observations, hardware compatibility or initiator links',()=>{
    const {project}=storageFixture(),old:any=structuredClone(project);old.schemaVersion=19
    expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 19');removeStorageReadinessV20(old)
    const migrated=parseProject(JSON.stringify(old));expect(migrated.schemaVersion).toBe(32);expect(migrated.design.storageInterfaces).toEqual([])
    expect(migrated.design.disks[0].values).toMatchObject({bus:'',presentation:'',evidence:''})
    old.design.disks[0].values.bus='sata';expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 19')
  })
  it('keeps links in exports and sanitized round trips, with deterministic review ordering',()=>{
    const {project,add}=storageFixture(),port=add('storageInterfaces','port-a',{host:'host-1',protocol:'fc',nativeId:'PRIVATE port',initiator:'2000000000000001'})
    const route=add('sanPaths','route-a',{host:'host-1',volume:'san-volume',interface:port.id,initiator:port.values.initiator,target:'5000000000000001',fabric:'EXAMPLE',state:'planned'})
    const before=storageReadiness(project,now);project.design.disks.reverse();project.design.storageSystems.reverse();expect(storageReadiness(project,now)).toEqual(before)
    const files=environmentFiles(project),plan=JSON.parse(files['plans/storage-readiness.json']);expect(plan.interfaces[0].inputs.nativeId).toBe('PRIVATE port');expect(plan.runtimeQualified).toBe(false)
    expect(topology(project).drawio).toContain('source="n:'+port.id+'" target="n:'+route.id+'"')
    const shared=parseProject(serializeProject(sanitizeProject(project)));expect(JSON.stringify(shared)).not.toContain('PRIVATE port');expect(shared.design.sanPaths[0].values.interface).toBe(shared.design.storageInterfaces[0].id)
  })
  it('requires role installation when an existing Hyper-V role is unavailable',()=>{
    for(const state of ['baremetal','installed']){const {project,nodes}=clusterFixture();Object.assign(nodes[0].values,{currentState:state,hostRoleAction:'configure',hostRoleOwner:'native'});expect(hostDeploymentPlan(project,now).findings.some(f=>f.code==='HOST_ROLE_UNAVAILABLE')).toBe(true)}
  })
})
