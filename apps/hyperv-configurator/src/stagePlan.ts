import type { Project } from './project'
import type { Finding } from './validation'
import { referenceOptions } from './references'

/** JSON arrays preserve custom IDs containing whitespace; delimited input is convenient for UUIDs. */
export function parseIds(value: unknown): string[] {
  const text = String(value ?? '').trim()
  if (!text) return []
  if (text.startsWith('[')) {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Use a JSON array of non-empty resource IDs.')
    return parsed.map(id => (id as string).trim())
  }
  return text.split(/[\s,;]+/).filter(Boolean)
}

export type StageDisposition = 'blocked' | 'reported-passed' | 'in-progress' | 'review-failure' | 'awaiting-operator' | 'handoff-candidate'
export interface PlannedStage {
  id: string; name: string; kind: string; owner: string; executor: string
  targets: string[]; dependsOn: string[]; reportedState: string; disposition: StageDisposition
  consumer: string; version: string; runner: string; credentialRef: string
  inputs: string; acceptance: string; rollback: string; evidence: string; observedAt: string
}

export function stagePlan(project: Project) {
  const findings: Finding[] = [], stages: PlannedStage[] = []
  const add = (code: string, message: string, recordId?: string) => findings.push({ code, message, recordId, section: 'automation', severity: 'error' })
  const resourceIds = new Set(referenceOptions(project, '$resources').map(r => r.id))
  const stageIds = new Set(project.design.stages.map(s => s.id))
  const omeIds = new Set(project.components.filter(c => c.product === 'ome').map(c => c.id))
  const kindTargets: Record<string, Set<string>> = {
    host: new Set(project.design.hosts.map(h => h.id)), cluster: new Set(project.design.clusters.map(c => c.id)),
    management: new Set(project.components.map(c => c.id)), ome: omeIds,
  }
  for (const row of project.design.stages) {
    const v = row.values, name = String(v.name || 'Unnamed stage')
    const ids = (key: string) => {
      try {
        const result = parseIds(v[key])
        if (new Set(result).size !== result.length) add('STAGE_DUPLICATE_REFERENCE', `${name}: ${key} contains repeated IDs.`, row.id)
        return [...new Set(result)].sort()
      } catch { add('STAGE_ID_LIST', `${name}: ${key} must be an ID list or JSON array of strings.`, row.id); return [] }
    }
    const targets = ids('targets'), dependsOn = ids('dependsOn')
    if (!targets.length) add('STAGE_TARGETS', `${name}: select explicit target resource IDs, including targets for prerequisite checks.`, row.id)
    for (const target of targets) if (!resourceIds.has(target)) add('STAGE_TARGET_MISSING', `${name}: target ${target} is missing or outside the active design.`, row.id)
    const eligible = kindTargets[String(v.kind)]
    if (eligible && targets.some(id => resourceIds.has(id) && !eligible.has(id))) add('STAGE_TARGET_KIND', `${name}: target resource types do not match the ${v.kind} stage.`, row.id)
    for (const id of dependsOn) if (!stageIds.has(id)) add('STAGE_DEPENDENCY_MISSING', `${name}: prerequisite stage ${id} is missing.`, row.id)
    if (dependsOn.includes(row.id)) add('STAGE_SELF_DEPENDENCY', `${name}: a stage cannot depend on itself.`, row.id)
    if (['name', 'owner', 'kind', 'executor', 'acceptance', 'status'].some(key => !String(v[key] ?? '').trim())) add('STAGE_DETAILS', `${name}: record its name, owner, kind, executor, acceptance checks and observed state.`, row.id)
    if (v.executor !== 'operator' && (v.kind === 'ome' || (v.kind === 'management' && targets.some(id => omeIds.has(id))))) add('STAGE_OME_MANUAL', `${name}: OME installation must be an operator task, including stages labelled management installation.`, row.id)
    if (v.status === 'failed' && (!v.evidence || !v.rollback)) add('STAGE_FAILURE_REVIEW', `${name}: attach failure evidence and a reviewed recovery/resume procedure.`, row.id)
    const timestamp = String(v.observedAt)
    const date = timestamp.slice(0, 10), calendarDate = new Date(`${date}T00:00:00Z`)
    const validTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) && Number.isFinite(Date.parse(timestamp)) && Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === date
    if (v.status === 'passed' && (!v.evidence || !validTime)) add('STAGE_COMPLETION_EVIDENCE', `${name}: reported completion requires evidence and an ISO timestamp with a timezone.`, row.id)
    if(v.status==='passed'&&validTime&&Date.parse(timestamp)>Date.parse(project.updatedAt))findings.push({code:'STAGE_FUTURE_EVIDENCE',section:'automation',recordId:row.id,fieldKey:'observedAt',severity:'error',message:`${name}: completion cannot be observed after this design assessment date.`})
    stages.push({ id: row.id, name, kind: String(v.kind), owner: String(v.owner), executor: String(v.executor), targets, dependsOn,
      reportedState: String(v.status), disposition: 'blocked', consumer: String(v.consumer), version: String(v.version), runner: String(v.runner), credentialRef: String(v.credentialRef),
      inputs: String(v.inputs), acceptance: String(v.acceptance), rollback: String(v.rollback), evidence: String(v.evidence), observedAt: timestamp })
  }
  const byId = new Map(stages.map(s => [s.id, s]))
  const pending = new Set(stageIds), waves: string[][] = []
  while (pending.size) {
    const wave = [...pending].filter(id => byId.get(id)!.dependsOn.every(dep => stageIds.has(dep) && !pending.has(dep))).sort()
    if (!wave.length) break
    waves.push(wave)
    for (const id of wave) pending.delete(id)
  }
  for (const id of pending) add('STAGE_ORDER_BLOCKED', `${byId.get(id)!.name}: a cycle or missing prerequisite blocks stage ordering.`, id)
  for (const wave of waves) for (const id of wave) {
    const stage = byId.get(id)!, prerequisites = stage.dependsOn.map(dep => byId.get(dep)!)
    const prerequisitesReportedPassed = prerequisites.every(s => s.disposition === 'reported-passed')
    if (['passed', 'running'].includes(stage.reportedState) && !prerequisitesReportedPassed) add('STAGE_PREMATURE_STATE', `${stage.name}: reported ${stage.reportedState} while a prerequisite lacks consistent completion evidence.`, id)
    if (findings.some(f => f.recordId === id)) continue
    if (!prerequisitesReportedPassed) continue
    stage.disposition = stage.reportedState === 'passed' ? 'reported-passed'
      : stage.reportedState === 'running' ? 'in-progress'
      : stage.reportedState === 'failed' ? 'review-failure'
      : stage.executor === 'operator' || stage.reportedState === 'manual' ? 'awaiting-operator' : 'handoff-candidate'
  }
  return { kind: 'hyperv-stage-plan', schemaVersion: 1, projectId: project.id, projectRevision: project.revision,
    executionState: 'not_executed_by_configurator', automationReady: false,
    evidenceBasis: 'User-entered observations; external receipts and runtime qualification have not been verified.',
    waves, blockedStageIds: stages.filter(s => s.disposition === 'blocked').map(s => s.id).sort(),
    stages: stages.sort((a, b) => a.id.localeCompare(b.id)), findings }
}
