import type { Answers } from './catalog'
import type { Project } from './project'
import type { Finding } from './validation'

export const normalizeStoragePath = (value: unknown) => {
  const source = String(value || '').trim().replace(/\//g, '\\').toLowerCase()
  if (/^[a-z]:\\+$/.test(source)) return source.slice(0,3)
  const path = source.replace(/\\+$/, '')
  return (path.startsWith('\\\\') ? '\\' : '') + path.replace(/\\+/g, '\\')
}
export function absoluteStoragePath(value: unknown): boolean {
  const path = normalizeStoragePath(value)
  return (/^[a-z]:\\(?:[^\\]|$)/.test(path) || /^\\\\[^\\\s]+\\[^\\\s]+/.test(path)) &&
    !/[<>"|?*\x00-\x1f]/.test(path) && !path.split('\\').some(p => p === '.' || p === '..' || /[. ]$/.test(p)) &&
    !path.slice(/^[a-z]:/.test(path) ? 2 : 0).includes(':')
}

/** Estimated full physical footprint. Never infer an encoding from node count alone. */
export function volumeFootprint(v: Answers, nodes: number, capacityDrives: Answers[]) {
  const findings: { code: string; message: string }[] = []
  const error = (code: string, message: string) => findings.push({code,message})
  const layout = String(v.resiliency), size = Number(v.sizeGiB) / 1024
  let factor: number | null = null, full: number | null = null
  const nested = layout === 'nestedMirror' || layout === 'nestedMap'
  if (nested && nodes !== 2) error('S2D_NESTED_NODES', 'Nested resiliency requires exactly two nodes.')
  if (layout === 'mirror2') factor = 2
  if (layout === 'mirror3') { factor = 3; if (nodes < 3) error('S2D_RESILIENCY_NODES', 'Three-way mirror requires at least three nodes.') }
  if (layout === 'nestedMirror') factor = 4
  const tiered = layout === 'map' || layout === 'nestedMap'
  if (['parity','map','nestedMap'].includes(layout)) {
    if (!v.layoutEvidence) error('S2D_TIER_REVIEW', 'Record exact storage tier and support evidence before estimating parity footprint.')
    const media = capacityDrives.filter(d => d.media === v.parityMedia)
    if (!v.parityMedia || !media.length) error('S2D_PARITY_MEDIA', 'Select parity media present in the capacity-drive inventory.')
    if (layout === 'nestedMap') {
      const columns = Number(v.parityColumns)
      const perHost = new Map<string, number>()
      for (const d of media) perHost.set(String(d.host), (perHost.get(String(d.host)) || 0) + Number(d.count))
      if (!Number.isInteger(columns) || columns < 4 || columns > 7 || perHost.size !== nodes || [...perHost.values()].some(n => n < columns)) error('S2D_PARITY_COLUMNS', 'Nested parity needs 4–7 reviewed columns and enough capacity drives of the selected media on each node.')
      else factor = 2 * columns / (columns - 1)
    } else {
      if (nodes < 4) error('S2D_RESILIENCY_NODES', 'Ordinary dual parity and mirror-accelerated parity require at least four nodes.')
      const encodings: Record<string, {factor:number; minNodes:number; media:string[]}> = {
        rs2: {factor:2,minNodes:4,media:['hdd','ssd','nvme']},
        rs4: {factor:1.5,minNodes:7,media:['hdd','ssd','nvme']},
        rs6: {factor:8/6,minNodes:9,media:['ssd','nvme']},
        lrc8: {factor:11/8,minNodes:12,media:['hdd']},
        lrc12: {factor:15/12,minNodes:16,media:['ssd','nvme']},
      }
      const encoding = encodings[String(v.parityLayout)]
      if (!encoding || nodes < encoding.minNodes || !encoding.media.includes(String(v.parityMedia))) error('S2D_PARITY_LAYOUT', 'Select an encoding compatible with the node count and parity media; verify actual tier metadata.')
      else factor = encoding.factor
    }
    if (tiered) {
      const mirror = Number(v.mirrorTierGiB), parity = Number(v.parityTierGiB)
      if (mirror <= 0 || parity <= 0 || Math.abs(mirror + parity - Number(v.sizeGiB)) > 1e-6) error('S2D_TIER_SIZES', 'Positive mirror and parity tier sizes must add up to the volume logical size.')
      else if (factor !== null) full = (mirror * (nested ? 4 : 3) + parity * factor) / 1024
      if (v.filesystem !== 'refs') error('S2D_TIER_FILESYSTEM', 'Mirror-accelerated parity requires ReFS.')
    }
  }
  if (!['mirror2','mirror3','nestedMirror','parity','map','nestedMap'].includes(layout)) error('S2D_RESILIENCY', 'Choose an S2D resiliency layout.')
  if (findings.length || factor === null) return {fullTiB:null,committedTiB:null,findings}
  if (!tiered) full = size * factor
  // Thin data can occupy either tier. A blended full-volume factor would understate current writes.
  const committed = v.provisioning === 'fixed' ? full : v.provisioning === 'thin' && !tiered ? Number(v.usedGiB) / 1024 * factor : null
  return { fullTiB:full, committedTiB:committed, findings }
}

export function storagePlacement(project: Project) {
  const findings: Finding[] = []
  const add = (code:string,id:string,message:string,severity:Finding['severity']='error') => findings.push({code,recordId:id,section:'storage',message,severity})
  const ordered = <T extends {id:string}>(rows:T[]) => [...rows].sort((a,b)=>a.id.localeCompare(b.id))
  const paths = ordered(project.design.storagePaths), allocations = ordered(project.design.storageAllocations), ioPaths = ordered(project.design.sanPaths)
  const resources = [
    ...project.design.workloads.map(r=>({id:r.id,name:String(r.values.name),sizeGiB:Number(r.values.provisionedGiB),usedGiB:Number(r.values.storageGiB)})),
    ...project.components.filter(c=>c.hosting!=='external').map(c=>({id:c.id,name:c.name,sizeGiB:c.diskGiB,usedGiB:null})),
    ...(project.sdn.scope==='none'?[]:project.design.sdnResources.filter(r=>r.values.role!=='hostcontroller').map(r=>({id:r.id,name:String(r.values.name),sizeGiB:Number(r.values.diskGiB),usedGiB:null}))),
  ]
  const seenPaths = new Set<string>(), seenDisks = new Set<string>(), seenIo = new Set<string>()
  for (const row of paths) {
    const v = row.values, volume = project.design.volumes.find(x=>x.id===v.volume), system = project.design.storageSystems.find(x=>x.id===volume?.values.system)
    const path = normalizeStoragePath(v.path), root = normalizeStoragePath(volume?.values.path)
    if (!volume || !absoluteStoragePath(path) || !absoluteStoragePath(root) || !(path === root || path.startsWith(root.endsWith('\\')?root:root+'\\'))) add('STORAGE_DIRECTORY_PATH',row.id,`${v.name}: use an absolute directory within the selected volume path.`)
    const key = `${system?.values.kind==='local' ? `host:${system.values.localHost}` : system?.values.cluster || system?.id}/${path}`
    if (seenPaths.has(key)) add('STORAGE_DIRECTORY_DUPLICATE',row.id,`${v.name}: this directory is already recorded in the same storage scope.`)
    seenPaths.add(key)
    if (volume && ['preserve','adopt'].includes(String(volume.values.lifecycle)) && ['create','replace'].includes(String(v.lifecycle))) add('STORAGE_DIRECTORY_LIFECYCLE',row.id,`${v.name}: creating or replacing a directory conflicts with a preserve-only volume.`)
  }
  for (const row of allocations) {
    const v=row.values, resource=resources.find(r=>r.id===v.resource), directory=paths.find(p=>p.id===v.directory)
    if (!resource || !directory) add('STORAGE_ALLOCATION_REFERENCE',row.id,`${v.name}: select a workload, hosted component or SDN VM and an existing storage directory.`)
    if (directory && directory.values.purpose !== 'disks' && directory.values.purpose !== 'other') add('STORAGE_ALLOCATION_PURPOSE',row.id,`${v.name}: disk capacity must map to a disk or other-data directory.`)
    if (!v.diskKey || Number(v.sizeGiB)<=0 || Number(v.usedGiB)>Number(v.sizeGiB)) add('STORAGE_ALLOCATION_SIZE',row.id,`${v.name}: enter a disk key and positive size with consumption no greater than size.`)
    const key=`${v.resource}/${String(v.diskKey).trim().toLowerCase()}`
    if(seenDisks.has(key)) add('STORAGE_ALLOCATION_DUPLICATE',row.id,`${v.name}: a disk key may be mapped only once for its resource.`)
    seenDisks.add(key)
  }
  for (const row of ioPaths) {
    const v=row.values, volume=project.design.volumes.find(x=>x.id===v.volume), system=project.design.storageSystems.find(x=>x.id===volume?.values.system), host=project.design.hosts.find(x=>x.id===v.host)
    if (!system || !['fc','iscsi'].includes(String(system.values.kind)) || !host || host.values.cluster!==system.values.cluster) add('SAN_PATH_TARGET',row.id,`${v.name}: select a SAN volume and host belonging to its cluster.`)
    const key=[v.volume,v.host,v.initiator,v.target,v.fabric].map(x=>String(x).trim().toLowerCase()).join('/')
    if(seenIo.has(key)) add('SAN_PATH_DUPLICATE',row.id,`${v.name}: this initiator/target/fabric route is already recorded.`)
    seenIo.add(key)
    if (v.state === 'failed') add('SAN_PATH_FAILED',row.id,`${v.name}: a failed I/O path must be resolved before acceptance.`)
    if (['active','standby'].includes(String(v.state)) && (!v.evidence || !Number.isFinite(Date.parse(String(v.observedAt))))) add('SAN_PATH_EVIDENCE',row.id,`${v.name}: observed path state requires dated multipath evidence.`)
  }
  const volumes=ordered(project.design.volumes).map(volume=>{
    const v=volume.values, system=project.design.storageSystems.find(s=>s.id===v.system)
    const directories=paths.filter(p=>p.values.volume===volume.id), disks=allocations.filter(a=>directories.some(p=>p.id===a.values.directory))
    const allocatedGiB=disks.reduce((n,a)=>n+Number(a.values.sizeGiB),0), usedGiB=disks.reduce((n,a)=>n+Number(a.values.usedGiB),0)
    const committedGiB=disks.reduce((n,a)=>n+Number(a.values.provisioning==='fixed'?a.values.sizeGiB:a.values.usedGiB),0)
    if (!v.lifecycle) add('VOLUME_LIFECYCLE',volume.id,`${v.name}: select an explicit volume lifecycle before preparing implementation.`)
    if (v.lifecycle==='create' && v.sourceIdentity) add('VOLUME_CREATE_EXISTING',volume.id,`${v.name}: an existing volume identity requires an explicit existing-resource lifecycle or replacement plan.`)
    if (v.lifecycle && v.lifecycle!=='create' && (!v.sourceIdentity || Number(v.currentSizeGiB)<=0 || !v.currentResiliency || !absoluteStoragePath(v.currentPath) || !v.currentProvisioning)) add('VOLUME_CURRENT_STATE',volume.id,`${v.name}: existing volumes need source identity, current size, path, provisioning and resiliency.`)
    if (['preserve','adopt'].includes(String(v.lifecycle)) && (Number(v.currentSizeGiB)!==Number(v.sizeGiB) || v.currentResiliency!==v.resiliency || normalizeStoragePath(v.currentPath)!==normalizeStoragePath(v.path) || v.currentProvisioning!==v.provisioning)) add('VOLUME_PRESERVE',volume.id,`${v.name}: preserve/adopt cannot change size, path, provisioning or resiliency.`)
    if (['configure','expand'].includes(String(v.lifecycle)) && (Number(v.sizeGiB)<Number(v.currentSizeGiB) || v.currentResiliency!==v.resiliency)) add('VOLUME_CONVERSION',volume.id,`${v.name}: shrinking or changing resiliency requires an explicit replacement/migration plan.`)
    if (v.lifecycle==='replace' && !v.replacementApproval) add('VOLUME_REPLACEMENT',volume.id,`${v.name}: record explicit replacement approval, backup and migration scope.`)
    if (allocatedGiB>Number(v.sizeGiB) || committedGiB>Number(v.sizeGiB)) add('STORAGE_DISK_CAPACITY',volume.id,`${v.name}: mapped disk allocations exceed its logical size.`)
    if (usedGiB>Number(v.usedGiB) || (v.provisioning==='thin' && committedGiB>Number(v.usedGiB))) add('STORAGE_DISK_CONSUMPTION',volume.id,`${v.name}: mapped consumption or fixed disk commitment exceeds the volume consumption budget.`)
    if (system && ['fc','iscsi'].includes(String(system.values.kind))) for (const host of ordered(project.design.hosts.filter(h=>h.values.cluster===system.values.cluster))) {
      const hostPaths=ioPaths.filter(p=>p.values.volume===volume.id&&p.values.host===host.id&&p.values.state!=='failed')
      if (new Set(hostPaths.map(p=>String(p.values.fabric).trim().toLowerCase()).filter(Boolean)).size<2) add('SAN_PATH_REDUNDANCY',volume.id,`${v.name} / ${host.values.name}: record at least two independent fabric/network routes.`, 'warning')
    }
    return {id:volume.id,name:String(v.name),lifecycle:String(v.lifecycle),directoryCount:directories.length,ioPathCount:ioPaths.filter(p=>p.values.volume===volume.id).length,allocationCount:disks.length,allocatedGiB,usedGiB,committedGiB,unallocatedGiB:Number(v.sizeGiB)-allocatedGiB}
  })
  const coverage=ordered(resources).map(resource=>{
    const disks=allocations.filter(a=>a.values.resource===resource.id), mappedGiB=disks.reduce((n,a)=>n+Number(a.values.sizeGiB),0), mappedUsedGiB=disks.reduce((n,a)=>n+Number(a.values.usedGiB),0)
    if (mappedGiB>resource.sizeGiB || (resource.usedGiB!==null&&mappedUsedGiB>resource.usedGiB)) add('STORAGE_RESOURCE_OVERALLOCATED',resource.id,`${resource.name}: mapped disks exceed the resource's recorded demand.`)
    if (mappedGiB<resource.sizeGiB) add('STORAGE_RESOURCE_UNMAPPED',resource.id,`${resource.name}: ${resource.sizeGiB-mappedGiB} GiB of disk demand has no volume mapping.`, 'warning')
    return {...resource,mappedGiB,mappedUsedGiB,unmappedGiB:resource.sizeGiB-mappedGiB}
  })
  return {volumes,resources:coverage,directories:paths,allocations,ioPaths,findings}
}
