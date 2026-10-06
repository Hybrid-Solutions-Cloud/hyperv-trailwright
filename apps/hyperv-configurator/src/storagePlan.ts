import type { Project } from './project'
import { storagePlacement, volumeFootprint, normalizeStoragePath, absoluteStoragePath } from './storageLayout'
import type { Finding } from './validation'
import {storageReadiness} from './storageReadiness'

export const STORAGE_REVIEW = {
  version: '0.2.0', reviewedAt: '2026-09-11',
  sources: [
    'https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/plan-volumes',
    'https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements',
    'https://learn.microsoft.com/en-us/windows-server/failover-clustering/storage-architectures',
    'https://learn.microsoft.com/en-us/windows-server/failover-clustering/failover-cluster-csvs',
    'https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/nested-resiliency',
    'https://learn.microsoft.com/en-us/windows-server/storage/storage-spaces/fault-tolerance',
  ],
} as const
export const storageAssumptions = [
  'GiB and TiB are binary units (1024 GiB = 1 TiB). Inputs describe the desired design, not observed free space.',
  'Usable capacity and the entered reserve are logical capacity. Committed logical demand uses full size for fixed volumes and expected consumption for thin volumes. Growth to all logical limits is shown separately.',
  'S2D raw footprint is a lower-bound resiliency estimate before metadata, slabs and alignment. Boot and cache drives never count as pool capacity. The separate physical repair allowance is derived from capacity drives; it is not the entered logical reserve.',
  'Parity estimates require an explicit encoding/media layout and review evidence. Tiered volumes require exact logical tier sizes. Thin tiered current raw usage remains unknown because the current tier distribution is not observed. External array and file-service efficiencies are never inferred.',
  'Recorded volumes are counted once per backend. Disk allocations are reconciled within volume budgets and against workload/component demand; they are not added again. Storage directories and SAN I/O paths never add capacity.',
  'Passing planning checks is not hardware, storage presentation, performance, thin-provisioning support or failover qualification. Verify the selected OS/build, firmware, filesystem, topology and storage owner before deployment.',
]
export function capacityText(value: number | null): string { return value === null ? 'Unknown' : `${Number(value.toFixed(3)).toLocaleString('en-US')} TiB` }
const normalizedPath = normalizeStoragePath
const csvPath = (value: unknown) => /^[a-z]:\\clusterstorage\\[^\\]+$/i.test(normalizedPath(value))
const uncPath = (value: unknown) => /^\\\\[^\\\s]+\\[^\\]+/.test(normalizedPath(value))

export function storagePlan(project: Project) {
  const placement = storagePlacement(project)
  const readiness=storageReadiness(project)
  const findings: Finding[] = [...placement.findings,...readiness.findings]
  const incompatibleDisks=new Set(readiness.disks.filter(d=>d.status==='incompatible').map(d=>d.id))
  const add = (code: string, id: string, message: string, severity: Finding['severity'] = 'error') => findings.push({ code, section: 'storage', recordId: id, severity, message })
  const ordered = <T extends { id: string }>(rows: T[]) => [...rows].sort((a,b) => a.id.localeCompare(b.id))
  const paths = new Map<string,string>()
  for (const drive of ordered(project.design.disks)) {
    const d = drive.values, name = String(d.name || 'Drive group')
    if (!Number.isInteger(d.count) || Number(d.count) < 1 || Number(d.sizeGiB) <= 0) add('DRIVE_QUANTITY', drive.id, `${name}: enter a whole positive drive count and positive capacity per drive.`)
    if (!d.media || !d.role) add('DRIVE_TYPE', drive.id, `${name}: select the media and boot/cache/capacity role.`)
  }
  const systems = ordered(project.design.storageSystems).map(system => {
    const s = system.values, name = String(s.name || 'Storage system'), s2d = s.kind === 's2d', san = ['fc','iscsi'].includes(String(s.kind))
    const cluster = project.design.clusters.find(c => c.id === s.cluster)
    const members = ordered(project.design.hosts.filter(h => h.values.cluster === s.cluster))
    if (s.kind==='local' && !members.some(h=>h.id===s.localHost)) add('LOCAL_STORAGE_HOST',system.id,`${name}: select the node that owns this local storage in the selected cluster.`)
    const volumes = ordered(project.design.volumes.filter(v => v.values.system === system.id))
    const usableTiB = Number(s.usableTiB), reserveTiB = Number(s.reserveTiB), rawTiB = Number(s.rawTiB)
    const availableTiB = usableTiB - reserveTiB
    if (usableTiB <= 0) add('STORAGE_USABLE', system.id, `${name}: enter a positive usable capacity for this backend.`)
    if (reserveTiB > usableTiB) add('STORAGE_RESERVE', system.id, `${name}: logical reserve exceeds usable capacity.`)
    if (!volumes.length) add('STORAGE_VOLUMES', system.id, `${name}: record the volumes or shares to be allocated.`, 'warning')
    if (san) {
      if (!s.endpoint || !s.mpio || !(s.kind === 'fc' ? s.fabrics : s.portals)) add('SAN_PRESENTATION', system.id, `${name}: record the array/target endpoint, MPIO provider/policy and ${s.kind === 'fc' ? 'fabric zoning/WWPN mapping' : 'target portals/initiator IQNs/path diversity'}.`)
      if (!s.vendor || !s.version || !s.recovery) add('SAN_QUALIFICATION', system.id, `${name}: record vendor/model, firmware and recovery/support qualification.`, 'warning')
    }
    if (s.kind === 'smb' && (!s.endpoint || !s.permissions)) add('SMB_HANDOFF', system.id, `${name}: record the file-service endpoint, permissions, availability and SMB transport design.`)
    const drives = ordered(project.design.disks.filter(d => members.some(h => h.id === d.values.host)))
    const capacities = drives.filter(d => d.values.role === 'capacity')
    const driveInventoryComplete = members.length > 0 && members.every(h => capacities.some(d => d.values.host === h.id)) && capacities.every(d => Number.isInteger(d.values.count) && Number(d.values.count) > 0 && Number(d.values.sizeGiB) > 0 && !!d.values.media) && drives.filter(d=>d.values.role!=='boot').every(d=>!incompatibleDisks.has(d.id))
    // A physical host inventory cannot be allocated twice to separate S2D pools.
    const uniquePool = project.design.storageSystems.filter(x => x.values.kind === 's2d' && x.values.cluster === s.cluster).length === 1
    const inventoryRawTiB = s2d && driveInventoryComplete && uniquePool ? capacities.reduce((n,d) => n + Number(d.values.count) * Number(d.values.sizeGiB) / 1024, 0) : null
    const repairReserveTiB = inventoryRawTiB === null ? null : [...new Set(capacities.map(d => d.values.media))].reduce<number>((n,media) => n + Math.max(...capacities.filter(d => d.values.media === media).map(d => Number(d.values.sizeGiB))) / 1024 * Math.min(members.length,4), 0)
    if (s2d) {
      if (!cluster || !['ws2022','ws2025'].includes(String(cluster.values.os)) || cluster.values.edition !== 'datacenter') add('S2D_PLATFORM', system.id, `${name}: this physical S2D planning path requires a reviewed Windows Server 2022/2025 Datacenter cluster.`)
      if (members.length < 2 || members.length > 16 || cluster?.values.topology === 'standalone') add('S2D_NODES', system.id, `${name}: physical Windows Server S2D requires 2–16 cluster nodes.`)
      if (!uniquePool) add('S2D_POOL_OWNERSHIP', system.id, `${name}: multiple S2D backend records would reuse the same host drives. Record one pool per cluster; model SAN separately.`)
      if (!s.diskEligibility) add('S2D_ELIGIBILITY', system.id, `${name}: document direct-attached disk/controller eligibility and hardware validation.`)
      if (!driveInventoryComplete) add('S2D_DRIVE_INVENTORY', system.id, `${name}: add valid capacity drive groups for every member; physical footprint headroom remains unknown.`)
      for (const host of members) {
        const hostDrives = drives.filter(d => d.values.host === host.id), capacity = hostDrives.filter(d => d.values.role === 'capacity'), cache = hostDrives.filter(d => d.values.role === 'cache')
        const count = (rows: typeof drives) => rows.reduce((n,d) => n + Number(d.values.count),0)
        if (count(capacity) < 4) add('S2D_CAPACITY_DRIVES', system.id, `${name} / ${host.values.name}: record at least four capacity drives for a physical Windows Server node.`)
        if ((cache.length > 0 || capacity.some(d => d.values.media === 'hdd')) && count(cache) < 2) add('S2D_CACHE_DRIVES', system.id, `${name} / ${host.values.name}: HDD capacity or enabled caching requires at least two cache drives.`)
        if (cache.some(d => d.values.media === 'hdd' || Number(d.values.sizeGiB) * 1024 ** 3 < 32 * 1000 ** 3)) add('S2D_CACHE_MEDIA', system.id, `${name} / ${host.values.name}: cache must use suitable flash media of at least 32 GB per device.`)
      }
      // Compare grouped counts, not row order: splitting one group into two must be equivalent.
      const signature = (id: string) => {
        const groups = new Map<string,number>()
        for (const d of drives.filter(d => d.values.host === id && d.values.role !== 'boot')) { const key = `${d.values.role}/${d.values.media}/${d.values.sizeGiB}`; groups.set(key,(groups.get(key)||0)+Number(d.values.count)) }
        return JSON.stringify([...groups].sort(([a],[b])=>a.localeCompare(b)))
      }
      if (new Set(members.map(h=>signature(h.id))).size > 1) add('S2D_DRIVE_SYMMETRY', system.id, `${name}: node drive roles, media, sizes or counts differ. Review supported symmetry and stranded capacity.`, 'warning')
      if (rawTiB <= 0) add('S2D_RAW_CAPACITY', system.id, `${name}: enter the pool raw capacity, excluding boot and cache drives.`)
      if (inventoryRawTiB !== null && rawTiB > inventoryRawTiB + 1e-8) add('S2D_RAW_INVENTORY', system.id, `${name}: declared raw capacity exceeds the recorded capacity drives.`)
      if (usableTiB > rawTiB && rawTiB > 0) add('S2D_USABLE_RAW', system.id, `${name}: usable capacity exceeds raw capacity before resiliency overhead.`)
    }
    const lunIds = new Set<string>()
    const volumeRows = volumes.map(volume => {
      const v = volume.values, volumeName = String(v.name || 'Volume'), sizeTiB = Number(v.sizeGiB)/1024, consumedTiB = Number(v.usedGiB)/1024
      const committedTiB = v.provisioning === 'fixed' ? sizeTiB : v.provisioning === 'thin' ? consumedTiB : null
      if (sizeTiB <= 0) add('VOLUME_SIZE', volume.id, `${volumeName}: enter a positive logical volume size.`)
      if (consumedTiB > sizeTiB) add('VOLUME_CONSUMPTION', volume.id, `${volumeName}: expected consumption exceeds logical size.`)
      if (committedTiB === null) add('VOLUME_PROVISIONING', volume.id, `${volumeName}: choose fixed or thin provisioning before calculating committed demand.`)
      if (!v.filesystem) add('VOLUME_FILESYSTEM', volume.id, `${volumeName}: select the filesystem.`)
      if (!absoluteStoragePath(v.path)) add('VOLUME_PATH', volume.id, `${volumeName}: record an absolute CSV, mount or share path without traversal.`)
      const path = normalizedPath(v.path)
      if (path && s.cluster) {
        const key = `${s.kind==='local' ? `host:${s.localHost}` : s.cluster}/${path}`
        if (paths.has(key)) add('VOLUME_PATH_DUPLICATE', volume.id, `${volumeName}: another volume uses the same path in this cluster.`)
        paths.set(key,volume.id)
      }
      if (s.kind === 'local' && csvPath(v.path)) add('LOCAL_CSV', volume.id, `${volumeName}: node-local storage is not a shared CSV. Select the actual shared backend or a local mount path.`)
      if (s.kind === 'smb') {
        if (!uncPath(v.path) || v.filesystem !== 'external') add('SMB_VOLUME', volume.id, `${volumeName}: use a UNC share path and External file service filesystem for SMB storage.`)
      } else if (v.filesystem === 'external' || uncPath(v.path)) add('BLOCK_VOLUME_PATH', volume.id, `${volumeName}: a block-storage volume needs a Windows filesystem and local CSV/mount path.`)
      if (san) {
        if (!v.lunId || !v.hostMapping) add('SAN_LUN_MAPPING', volume.id, `${volumeName}: record the LUN identifier and exact host-group/presentation mapping.`)
        const lunId = String(v.lunId).trim().toLowerCase()
        if (lunId && lunIds.has(lunId)) add('SAN_LUN_DUPLICATE', volume.id, `${volumeName}: duplicate LUN identifier in this array/backend.`)
        if (lunId) lunIds.add(lunId)
        if (csvPath(v.path) && v.filesystem === 'refs') add('SAN_CSV_FILESYSTEM', volume.id, `${volumeName}: Microsoft recommends NTFS for SAN CSVs; review ReFS redirected-I/O implications.`, 'warning')
      }
      if (!s2d && v.resiliency && v.resiliency !== 'external') add('EXTERNAL_RESILIENCY', volume.id, `${volumeName}: S2D mirror/parity selections do not configure this backend. Record array/service protection separately.`)
      let raw = { committedTiB: null as number | null, fullTiB: null as number | null }
      if (s2d) {
        const footprint = volumeFootprint(v, members.length, capacities.map(d=>d.values))
        for (const f of footprint.findings) add(f.code,volume.id,`${volumeName}: ${f.message}`)
        raw = footprint
        if (v.provisioning==='thin' && ['map','nestedMap'].includes(String(v.resiliency))) add('S2D_THIN_TIER_USAGE',volume.id,`${volumeName}: current raw usage needs observed tier distribution; only full-growth footprint is estimated.`, 'warning')
        if (v.provisioning === 'thin') add('S2D_THIN_SUPPORT', volume.id, `${volumeName}: verify thin provisioning against the exact Windows Server release/build and management tool.`, 'warning')
        if (v.filesystem === 'ntfs') add('S2D_FILESYSTEM_REVIEW', volume.id, `${volumeName}: ReFS is recommended for S2D; document any workload requirement for NTFS.`, 'warning')
      }
      if (v.provisioning === 'thin' && !v.policy) add('THIN_GROWTH_POLICY', volume.id, `${volumeName}: record growth monitoring, thresholds, expansion and recovery ownership.`, 'warning')
      return { id: volume.id, name: volumeName, systemId: system.id, provisioning: String(v.provisioning), resiliency: String(v.resiliency), sizeTiB, consumedTiB, committedTiB, estimatedRawCommittedTiB: raw.committedTiB, estimatedRawFullTiB: raw.fullTiB }
    })
    const sumKnown = (values: (number|null)[]) => values.some(v=>v===null) ? null : (values as number[]).reduce((n,v)=>n+v,0)
    const logicalTiB = volumeRows.reduce((n,v)=>n+v.sizeTiB,0), consumedTiB = volumeRows.reduce((n,v)=>n+v.consumedTiB,0)
    const committedTiB = sumKnown(volumeRows.map(v=>v.committedTiB))
    const rawCommittedTiB = s2d ? sumKnown(volumeRows.map(v=>v.estimatedRawCommittedTiB)) : null
    const rawFullTiB = s2d ? sumKnown(volumeRows.map(v=>v.estimatedRawFullTiB)) : null
    const rawHeadroomTiB = rawTiB > 0 && rawCommittedTiB !== null && repairReserveTiB !== null ? Math.min(rawTiB,inventoryRawTiB!) - repairReserveTiB - rawCommittedTiB : null
    const rawFullHeadroomTiB = rawTiB > 0 && rawFullTiB !== null && repairReserveTiB !== null ? Math.min(rawTiB,inventoryRawTiB!) - repairReserveTiB - rawFullTiB : null
    if (committedTiB !== null && committedTiB > availableTiB) add('STORAGE_CAPACITY', system.id, `${name}: fixed allocations plus expected thin consumption exceed usable capacity after logical reserve.`)
    if (logicalTiB > availableTiB && volumeRows.some(v=>v.provisioning==='thin')) add('THIN_FULL_GROWTH', system.id, `${name}: all volumes growing to their logical limits would exceed capacity after reserve. Record monitoring and an expansion plan.`, 'warning')
    if (rawHeadroomTiB !== null && rawHeadroomTiB < 0) add('S2D_RAW_FOOTPRINT', system.id, `${name}: estimated mirror footprint plus physical repair allowance exceeds recorded pool capacity.`)
    if (rawFullHeadroomTiB !== null && rawFullHeadroomTiB < 0 && volumeRows.some(v=>v.provisioning==='thin')) add('S2D_RAW_FULL_GROWTH', system.id, `${name}: full thin-volume growth would exhaust raw capacity after the estimated physical repair allowance.`, 'warning')
    return { id:system.id,name,kind:String(s.kind),clusterId:String(s.cluster),nodeCount:members.length,volumeCount:volumes.length,csvCount:volumes.filter(v=>csvPath(v.values.path)).length,thinCount:volumes.filter(v=>v.values.provisioning==='thin').length,fixedCount:volumes.filter(v=>v.values.provisioning==='fixed').length,usableTiB,reserveTiB,availableTiB,logicalTiB,consumedTiB,committedTiB,headroomTiB:committedTiB===null?null:availableTiB-committedTiB,fullGrowthHeadroomTiB:availableTiB-logicalTiB,rawTiB,inventoryRawTiB,repairReserveTiB,rawCommittedTiB,rawFullTiB,rawHeadroomTiB,rawFullHeadroomTiB,volumes:volumeRows }
  })
  return { kind:'hyperv-storage-assessment',schemaVersion:2,projectId:project.id,projectRevision:project.revision,review:STORAGE_REVIEW,executionState:'not-executed',automationReady:false,systems,placement,findings,assumptions:storageAssumptions }
}

export function storageSchedule(project: Project) {
  return storagePlan(project).systems.map(s=>({Backend:s.name,Kind:s.kind,Volumes:s.volumeCount,CSVs:s.csvCount,Fixed:s.fixedCount,Thin:s.thinCount,UsableTiB:s.usableTiB,LogicalReserveTiB:s.reserveTiB,LogicalLimitTiB:s.logicalTiB,ExpectedDataTiB:s.consumedTiB,CommittedTiB:s.committedTiB ?? 'Unknown',HeadroomTiB:s.headroomTiB ?? 'Unknown',FullGrowthHeadroomTiB:s.fullGrowthHeadroomTiB,InventoryRawTiB:s.inventoryRawTiB ?? 'Unknown',PhysicalRepairAllowanceTiB:s.repairReserveTiB ?? 'Unknown',EstimatedRawCommittedTiB:s.rawCommittedTiB ?? 'Unknown',EstimatedRawHeadroomTiB:s.rawHeadroomTiB ?? 'Unknown'}))
}
