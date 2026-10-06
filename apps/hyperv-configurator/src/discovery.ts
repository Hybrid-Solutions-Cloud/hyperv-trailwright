import { sha256Hex } from '@configurators/output'
import { serializeProject, type Project } from './project'
import { validateSnapshot, observationIdentity, type DiscoverySnapshot, type DriftReview, type ObservedValue, type Observation } from './discoveryContract'

export const DISCOVERY_MAX_AGE_DAYS = 7
function target(project: Project, observation: Observation) {
  if (observation.resourceType === 'components') return project.components.find(c => c.id === observation.targetId)
  return project.design[observation.resourceType]?.find(r => r.id === observation.targetId)?.values
}
function compatible(project: Project, snapshot: DiscoverySnapshot, observation: Observation) {
  if (observation.resourceType !== 'components' || snapshot.source.provider === 'manual') return true
  const c = project.components.find(c => c.id === observation.targetId)
  if (!c) return false
  return snapshot.source.provider === 'vsphere' ? c.hosting === 'vsphere' : snapshot.source.provider === 'vcd' ? c.hosting === 'vcd' : c.hosting.startsWith('hyperv-')
}
export async function importDiscovery(project: Project, source: string | Uint8Array, fileName: string, now = new Date().toISOString()): Promise<Project> {
  const bytes=typeof source==='string'?new TextEncoder().encode(source):Uint8Array.from(source)
  if (bytes.length > 2*1024*1024) throw new Error('Discovery file exceeds 2 MiB.')
  let raw: unknown
  try { raw = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) } catch { throw new Error('Choose a valid UTF-8 discovery JSON snapshot.') }
  validateSnapshot(raw)
  if (raw.projectId !== project.id) throw new Error('Discovery snapshot belongs to another project.')
  if (Date.parse(raw.collectedAt) > Date.parse(now)+300000) throw new Error('Discovery collection time is in the future.')
  for (const observation of raw.observations) {
    if (!target(project,observation)) throw new Error(`Discovery target ${observation.targetId} is missing or has the wrong resource type.`)
    if (!compatible(project,raw,observation)) throw new Error(`Discovery provider does not match hosting for ${observation.targetId}.`)
  }
  const sha256 = await sha256Hex(bytes)
  if (project.discovery.snapshots.some(e => e.sha256 === sha256 || e.snapshot.id === raw.id)) throw new Error('This discovery snapshot was already imported; IDs cannot be reused.')
  const next = structuredClone(project)
  next.discovery.snapshots.push({snapshot:raw,sha256,fileName,importedAt:now})
  next.updatedAt=now
  serializeProject(next)
  return next
}
export interface DriftRow {
  key: string; snapshotId: string; targetId: string; resourceType: Observation['resourceType']; name: string; field: string
  desired: ObservedValue; observed: ObservedValue; externalId: string; provider: string; source: string; collectedAt: string; sha256: string; observationNote: string
  status: 'matches' | 'drift' | 'blocked'; blockingReason: string; priorIdentities: string[]; review: DriftReview | undefined; reviewCurrent: boolean; canAdopt: boolean
}
export function driftRows(project: Project, now = new Date().toISOString()): DriftRow[] {
  const byTarget = new Map<string,{snapshot:DiscoverySnapshot;sha256:string;observation:Observation}[]>()
  for (const entry of project.discovery.snapshots) for (const observation of entry.snapshot.observations) {
    const list=byTarget.get(observation.targetId) ?? []; list.push({...entry,observation}); byTarget.set(observation.targetId,list)
  }
  const rows:DriftRow[]=[]
  for (const [targetId,entries] of [...byTarget].sort(([a],[b])=>a.localeCompare(b))) {
    entries.sort((a,b)=>Date.parse(b.snapshot.collectedAt)-Date.parse(a.snapshot.collectedAt)||a.snapshot.id.localeCompare(b.snapshot.id))
    const {snapshot,observation,sha256}=entries[0], current=target(project,observation)
    const identity=observationIdentity(snapshot,observation)
    const binding=[...project.discovery.reviews].reverse().find(r=>r.targetId===targetId&&r.decision==='remap')
    const bindingTime=binding&&binding.observedValue===identity ? project.discovery.snapshots.find(e=>e.snapshot.id===binding.snapshotId)?.snapshot.collectedAt : undefined
    const identityEntries=bindingTime ? entries.filter(e=>Date.parse(e.snapshot.collectedAt)>=Date.parse(bindingTime)) : entries
    let blockingReason=''
    if (!current) blockingReason='The design target no longer exists.'
    else if (entries.length>1 && Date.parse(entries[1].snapshot.collectedAt)===Date.parse(snapshot.collectedAt)) blockingReason='Multiple snapshots have the same collection time; a newer unambiguous observation is required.'
    else if (identityEntries.some(e=>observationIdentity(e.snapshot,e.observation)!==identity)) blockingReason='Source or external identity changed; review resource mapping before using this evidence.'
    else if (!compatible(project,snapshot,observation)) blockingReason='The provider no longer matches the designed hosting platform.'
    else if (Date.parse(now)-Date.parse(snapshot.collectedAt)>DISCOVERY_MAX_AGE_DAYS*86400000) blockingReason='Evidence is older than seven days; collect a fresh snapshot.'
    else if (Date.parse(snapshot.collectedAt)>Date.parse(now)) blockingReason='Collection time is in the future; wait for the recorded time or correct the source clock.'
    else if (observation.status==='unavailable') blockingReason='Collection was unavailable. Absence is not proof that a resource was deleted.'
    const values=observation.status==='unavailable' ? {'':observation.message||'Unavailable'} : observation.values
    for (const [field,observed] of Object.entries(values).sort(([a],[b])=>a.localeCompare(b))) {
      const desired = current ? (current as unknown as Record<string,ObservedValue>)[field] ?? '' : ''
      const review=[...project.discovery.reviews].reverse().find(r=>r.snapshotId===snapshot.id&&r.targetId===targetId&&r.field===field)
      const reviewCurrent=!!review && !blockingReason && review.observedValue===observed && (review.decision==='adopt' ? desired===observed : review.expectedValue===desired)
      const lifecycle=String(current?.lifecycle??'')
      rows.push({key:JSON.stringify([snapshot.id,targetId,field]),snapshotId:snapshot.id,targetId,resourceType:observation.resourceType,name:String(current?.name||targetId),field,desired,observed,externalId:observation.externalId,provider:snapshot.source.provider,source:snapshot.source.endpoint,collectedAt:snapshot.collectedAt,sha256,observationNote:observation.message,
        status:blockingReason?'blocked':desired===observed?'matches':'drift',blockingReason,priorIdentities:[...new Set(identityEntries.map(e=>observationIdentity(e.snapshot,e.observation)).filter(s=>s!==identity))],review,reviewCurrent,canAdopt:!blockingReason&&['preserve','adopt','configure'].includes(lifecycle)})
    }
  }
  return rows
}
export function reviewDrift(project:Project,key:string,expected:ObservedValue,decision:Exclude<DriftReview['decision'],'remap'>,reviewer:string,reason:string,now=new Date().toISOString()):Project {
  const row=driftRows(project,now).find(r=>r.key===key)
  if (!row || row.status==='blocked') throw new Error('This observation is no longer eligible for review. Refresh discovery and resolve its findings.')
  if (row.desired!==expected) throw new Error('The design changed while this decision was being reviewed.')
  if (!reviewer.trim()||!reason.trim()) throw new Error('Record the reviewer and reason for this decision.')
  if (decision==='adopt'&&!row.canAdopt) throw new Error('Adoption requires an existing preserve/adopt/configure target. New, replacement and externally supplied targets require separate design review.')
  const next=structuredClone(project)
  if (decision==='adopt') {
    const current = row.resourceType==='components' ? next.components.find(c=>c.id===row.targetId) : next.design[row.resourceType].find(r=>r.id===row.targetId)?.values
    if (!current) throw new Error('Discovery target disappeared.')
    ;(current as unknown as Record<string,ObservedValue>)[row.field]=row.observed
  }
  next.discovery.reviews.push({snapshotId:row.snapshotId,targetId:row.targetId,field:row.field,decision,expectedValue:expected,observedValue:row.observed,reviewer:reviewer.trim(),reason:reason.trim(),reviewedAt:now})
  next.updatedAt=now; serializeProject(next); return next
}
export function confirmDiscoveryMapping(project:Project,key:string,reviewer:string,reason:string,now=new Date().toISOString()):Project {
  const row=driftRows(project,now).find(r=>r.key===key)
  if(!row||!row.blockingReason.startsWith('Source or external identity changed'))throw new Error('This identity mapping is no longer awaiting review.')
  if(!reviewer.trim()||!reason.trim())throw new Error('Record the reviewer and reason for the identity mapping.')
  const snapshot=project.discovery.snapshots.find(e=>e.snapshot.id===row.snapshotId)!.snapshot,observation=snapshot.observations.find(o=>o.targetId===row.targetId)!
  if(observation.status!=='observed'||!compatible(project,snapshot,observation)||Date.parse(now)-Date.parse(snapshot.collectedAt)>7*86400000||Date.parse(snapshot.collectedAt)>Date.parse(now))throw new Error('Identity review requires fresh, compatible observed inventory.')
  const prior=project.discovery.snapshots.filter(e=>e.snapshot.id!==snapshot.id).flatMap(e=>e.snapshot.observations.filter(o=>o.targetId===row.targetId).map(o=>({snapshot:e.snapshot,observation:o}))).sort((a,b)=>Date.parse(b.snapshot.collectedAt)-Date.parse(a.snapshot.collectedAt))[0]
  const next=structuredClone(project)
  next.discovery.reviews.push({snapshotId:snapshot.id,targetId:row.targetId,field:'$identity',decision:'remap',expectedValue:observationIdentity(prior.snapshot,prior.observation),observedValue:observationIdentity(snapshot,observation),reviewer:reviewer.trim(),reason:reason.trim(),reviewedAt:now})
  next.updatedAt=now;serializeProject(next);return next
}
export function driftPlan(project:Project,now=new Date().toISOString()) {
  return {kind:'hyperv-drift-review',schemaVersion:1,projectId:project.id,evaluatedOnUtc:now.slice(0,10),executionState:'not-executed',automationReady:false,
    rows:driftRows(project,now),reviews:project.discovery.reviews,
    limitations:['Imported source identity, times and values are unsigned operator evidence. File hashes identify input bytes, not authenticity.','Preserve keeps the design; adopt updates only the reviewed design field. Reconcile records intent and performs no infrastructure changes.','Unobserved fields and unavailable resources are unknown, never compliant or deleted. Native collector and provider runtime qualification remain pending.']}
}
