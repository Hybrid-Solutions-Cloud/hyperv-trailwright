import { collections } from './catalog'

export type ObservedValue = string | number | boolean
export const observedFields = {
  components: ['name', 'vCpu', 'memoryGiB', 'diskGiB'],
  hosts: ['name', 'fqdn', 'vendor', 'model', 'serial', 'uuid', 'memoryGiB', 'sockets', 'coresPerSocket'],
  networks: ['name', 'cidr', 'vlan', 'mtu'],
  adapters: ['name', 'mac'],
  volumes: ['name', 'sizeGiB'],
} as const
export type ResourceType = keyof typeof observedFields
export interface Observation { targetId: string; resourceType: ResourceType; externalId: string; status: 'observed' | 'unavailable'; values: Record<string, ObservedValue>; message: string }
export interface DiscoverySnapshot {
  kind: 'hyperv-discovery-snapshot'; schemaVersion: 1; id: string; projectId: string; collectedAt: string
  source: { provider: 'hyperv' | 'vmm' | 'vsphere' | 'vcd' | 'manual'; endpoint: string; collector: string; version: string }
  observations: Observation[]
}
export interface ImportedSnapshot { snapshot: DiscoverySnapshot; sha256: string; fileName: string; importedAt: string }
export interface DriftReview {
  snapshotId: string; targetId: string; field: string; decision: 'preserve' | 'adopt' | 'reconcile' | 'remap'
  expectedValue: ObservedValue; observedValue: ObservedValue; reviewer: string; reason: string; reviewedAt: string
}
export interface DiscoveryState { snapshots: ImportedSnapshot[]; reviews: DriftReview[] }
export function observationIdentity(snapshot:DiscoverySnapshot,observation:Observation):string {
  return JSON.stringify([snapshot.source.provider,snapshot.source.endpoint.toLowerCase(),observation.resourceType,observation.externalId.toLowerCase()])
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function object(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k))) throw new Error(`Invalid ${label} fields.`)
}
function text(value: unknown, label: string, max = 256, blank = false): asserts value is string {
  if (typeof value !== 'string' || (!blank && !value.trim()) || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`Invalid ${label}.`)
}
export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19)
}
export function fieldType(resource: ResourceType, key: string): 'string' | 'number' | 'boolean' {
  if (resource === 'components') return key === 'name' ? 'string' : 'number'
  const field = collections.find(c => c.key === resource)?.fields.find(f => f.key === key)
  if (!field) throw new Error(`Unknown discovery field ${resource}.${key}.`)
  return field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string'
}
function scalar(value: unknown): value is ObservedValue { return typeof value === 'string' && value.length <= 16000 || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9 }
export function validateSnapshot(raw: unknown): asserts raw is DiscoverySnapshot {
  object(raw, ['kind','schemaVersion','id','projectId','collectedAt','source','observations'], 'discovery snapshot')
  if (raw.kind !== 'hyperv-discovery-snapshot' || raw.schemaVersion !== 1) throw new Error('Unsupported discovery snapshot contract.')
  text(raw.id,'snapshot ID'); text(raw.projectId,'snapshot project ID')
  if (!validTime(raw.collectedAt)) throw new Error('Invalid discovery collection time; use UTC.')
  object(raw.source,['provider','endpoint','collector','version'],'discovery source')
  if (typeof raw.source.provider !== 'string' || !['hyperv','vmm','vsphere','vcd','manual'].includes(raw.source.provider)) throw new Error('Unknown discovery provider.')
  for (const key of ['endpoint','collector','version']) text(raw.source[key],`source ${key}`)
  if (!Array.isArray(raw.observations) || !raw.observations.length || raw.observations.length > 1000) throw new Error('A snapshot requires 1–1000 scoped observations.')
  const targets = new Set<string>(), identities = new Set<string>()
  for (const o of raw.observations) {
    object(o,['targetId','resourceType','externalId','status','values','message'],'observation')
    text(o.targetId,'target ID'); text(o.externalId,'external resource ID'); text(o.message,'observation message',1000,true)
    if (typeof o.resourceType !== 'string' || !Object.prototype.hasOwnProperty.call(observedFields, o.resourceType)) throw new Error('Unsupported discovery resource type.')
    if (targets.has(o.targetId) || identities.has(`${o.resourceType}/${o.externalId.toLowerCase()}`)) throw new Error('Ambiguous duplicate discovery target or external identity.')
    targets.add(o.targetId); identities.add(`${o.resourceType}/${o.externalId.toLowerCase()}`)
    if (typeof o.status !== 'string' || !['observed','unavailable'].includes(o.status) || !record(o.values)) throw new Error('Invalid observation status or values.')
    if ((o.status === 'unavailable' && Object.keys(o.values).length) || (o.status === 'observed' && !Object.keys(o.values).length)) throw new Error('Unavailable observations cannot provide values; observed resources need values.')
    const resource = o.resourceType as ResourceType
    for (const [key,value] of Object.entries(o.values)) {
      if (!(observedFields[resource] as readonly string[]).includes(key) || !scalar(value) || typeof value !== fieldType(resource,key)) throw new Error(`Invalid discovery value: ${resource}.${key}.`)
    }
  }
}
export function validateDiscovery(raw: unknown): asserts raw is DiscoveryState {
  object(raw,['snapshots','reviews'],'discovery state')
  if (!Array.isArray(raw.snapshots) || raw.snapshots.length > 20 || !Array.isArray(raw.reviews) || raw.reviews.length > 10000) throw new Error('Discovery history limit exceeded.')
  const snapshots = new Map<string,DiscoverySnapshot>(), hashes = new Set<string>()
  for (const entry of raw.snapshots) {
    object(entry,['snapshot','sha256','fileName','importedAt'],'imported discovery')
    validateSnapshot(entry.snapshot);text(entry.fileName,'discovery file name')
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || hashes.has(entry.sha256) || snapshots.has(entry.snapshot.id)) throw new Error('Invalid or duplicate discovery hash/ID.')
    if (!validTime(entry.importedAt) || Date.parse(entry.snapshot.collectedAt) > Date.parse(entry.importedAt)+300000) throw new Error('Discovery time is after import time.')
    hashes.add(entry.sha256); snapshots.set(entry.snapshot.id,entry.snapshot)
  }
  for (const review of raw.reviews) {
    object(review,['snapshotId','targetId','field','decision','expectedValue','observedValue','reviewer','reason','reviewedAt'],'drift review')
    text(review.reviewer,'reviewer');text(review.reason,'review reason',2000)
    for (const key of ['snapshotId','targetId','field']) text(review[key],`review ${key}`)
    if (typeof review.decision !== 'string' || !['preserve','adopt','reconcile','remap'].includes(review.decision) || !validTime(review.reviewedAt)) throw new Error('Invalid drift review decision or time.')
    const snapshot = snapshots.get(String(review.snapshotId)), observation = snapshot?.observations.find(o => o.targetId === review.targetId)
    if (!snapshot || !observation || !scalar(review.expectedValue) || typeof review.expectedValue !== typeof review.observedValue || Date.parse(review.reviewedAt) < Date.parse(snapshot.collectedAt)) throw new Error('Drift review does not match its observation.')
    if (review.decision==='remap') {
      if(review.field!=='$identity'||observation.status!=='observed'||review.observedValue!==observationIdentity(snapshot,observation))throw new Error('Identity review does not match its observation.')
    } else if (!Object.prototype.hasOwnProperty.call(observation.values,String(review.field)) || observation.values[String(review.field)]!==review.observedValue) throw new Error('Drift review does not match its observation.')
  }
}
