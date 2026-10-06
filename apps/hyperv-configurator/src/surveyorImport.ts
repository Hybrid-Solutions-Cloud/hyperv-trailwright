import { collections, newRecord } from './catalog'
import { MAX_PROJECT_BYTES, newComponent, newProject, type Component } from './project'

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
const text = (v: unknown) => typeof v === 'string' ? v.slice(0, 16000) : ''

export async function importSurveyor(source: string, fileName: string) {
  if (new TextEncoder().encode(source).length > MAX_PROJECT_BYTES) throw new Error('Surveyor file exceeds the 2 MiB limit.')
  let raw: unknown
  try { raw = JSON.parse(source) } catch { throw new Error('Choose a valid Hyper-V Surveyor JSON project.') }
  if (!isRecord(raw) || raw.kind !== 'hyperv-surveyor-project' || !isRecord(raw.payload)) throw new Error('This is not a Hyper-V Surveyor project.')
  if (![1, 2, 3, 4].includes(Number(raw.schemaVersion))) throw new Error('This Surveyor schema has not been qualified for import.')
  const payload = raw.payload, p = newProject()
  p.name = text(payload.customerName)
  p.scope = payload.engagementMode === 'management-only' ? 'management' : 'combined'
  const evidence = newRecord(collections.find(c => c.key === 'imports')!)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  evidence.values = { ...evidence.values, name: fileName, kind: 'surveyor', observedAt: p.createdAt, sourceVersion: `${raw.schemaVersion} / ${text(raw.engineVersion)}`, sha256: Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join(''), summary: `Planning path: ${text(payload.engagementMode)}. Management included in Surveyor sizing: ${payload.includeManagementInSizing === true ? 'yes' : 'no / unspecified'}. Imported workloads remain requirements, not created management VMs.` }
  p.design.imports.push(evidence)
  const inputVms = Array.isArray(payload.vms) ? payload.vms : []
  if (inputVms.length > 1000) throw new Error('Import currently supports up to 1,000 workloads. Preserve the larger source and import a scoped plan.')
  for (const vm of inputVms) {
    if (!isRecord(vm) || vm.include === false || !text(vm.name)) continue
    const row = newRecord(collections.find(c => c.key === 'workloads')!)
    row.values = { ...row.values, name: text(vm.name), source: evidence.id, sourceId: text(vm.id), vCpu: number(vm.vCpu), memoryGiB: number(vm.ramGiB), storageGiB: number(vm.storageGiB), provisionedGiB: number(vm.provisionedGiB), sourceHost: text(vm.sourceHost), sourceCluster: text(vm.sourceCluster) }
    p.design.workloads.push(row)
  }
  if (isRecord(payload.managementDeploymentInputs)) {
    const m = payload.managementDeploymentInputs
    const selected: Component['product'][] = []
    if (m.foundation === 'scvmm') selected.push('vmm', 'sql', 'library')
    if (m.monitoring === 'scom') selected.push('scom')
    if (m.wac && m.wac !== 'none') selected.push('wac')
    if (m.includeArc === true) selected.push('arc')
    if (m.includeIdentityServices === true) selected.push('identity')
    for (const product of selected) {
      const c = newComponent(product)
      if (m.managementPlacement === 'external-fabric') c.hosting = 'external'
      if (m.managementPlacement === 'workload-cluster') c.hosting = 'hyperv-workload'
      if (product === 'wac') c.productDetails.mode = m.wac === 'wac-virtual' ? 'virtualization' : 'administration'
      p.components.push(c)
    }
    p.requirements.monitoring = m.monitoring === 'scom'
    p.requirements.managementHa = m.fabricHighAvailability === true || m.highAvailability === true || m.scomHighAvailability === true
    evidence.values.summary += ` Managed hosts: ${number(m.managedHosts)}; managed clusters: ${number(m.managedClusters)}; managed VMs: ${number(m.managedVms)}. Detailed placement, identities, licensing and HA still require review.`
  }
  return p
}
