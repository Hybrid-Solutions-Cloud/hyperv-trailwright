import { describe, expect, it } from 'vitest'
import { collections, newRecord, type Answers } from './catalog'
import { newProject, newComponent, serializeProject, parseProject, type Project } from './project'
import { parseIds, stagePlan } from './stagePlan'
import { environmentFiles, implementationMarkdown } from './exports'
import { sanitizeProject } from './sanitize'
import { demoProject } from './scenarios'

function fixture() {
  const project = newProject(), host = newComponent('wac')
  host.name = 'Example service'; project.components.push(host)
  const add = (values: Answers = {}) => {
    const row = newRecord(collections.find(c => c.key === 'stages')!)
    row.values = { ...row.values, name: `Stage ${project.design.stages.length + 1}`, owner: 'Example operator', kind: 'validate', executor: 'operator', targets: JSON.stringify([host.id]), status: 'planned', acceptance: 'Expected acceptance output', ...values }
    project.design.stages.push(row)
    return row
  }
  return { project, host, add }
}
const completed = { status: 'passed', evidence: 'Example run artifact', observedAt: '2026-09-10T12:30:00Z' }

describe('stage ordering and resume handoff', () => {
  it('accepts UUID lists and JSON custom IDs while rejecting malformed arrays', () => {
    expect(parseIds('one, two; three\nfour')).toEqual(['one', 'two', 'three', 'four'])
    expect(parseIds('["custom ID", "other"]')).toEqual(['custom ID', 'other'])
    expect(() => parseIds('[null]')).toThrow()
    expect(() => parseIds('["one"')).toThrow()
  })
  it('orders prerequisites before dependants despite their entered stage number', () => {
    const { project, add } = fixture(), first = add({ ...completed, order: 99 }), second = add({ dependsOn: first.id, order: 1 })
    const plan = stagePlan(project)
    expect(plan.waves).toEqual([[first.id], [second.id]])
    expect(plan.stages.find(s => s.id === first.id)?.disposition).toBe('reported-passed')
    expect(plan.stages.find(s => s.id === second.id)?.disposition).toBe('awaiting-operator')
    expect(plan.automationReady).toBe(false)
  })
  it('does not accept a passed descendant with an incomplete prerequisite', () => {
    const { project, add } = fixture(), first = add(), second = add({ ...completed, dependsOn: first.id }), third = add({ dependsOn: second.id })
    const plan = stagePlan(project)
    expect(plan.findings.some(f => f.code === 'STAGE_PREMATURE_STATE' && f.recordId === second.id)).toBe(true)
    expect(plan.blockedStageIds).toEqual([second.id, third.id].sort())
  })
  it('contains cycles and missing dependencies without losing independent stages', () => {
    const { project, add } = fixture(), a = add(), b = add({ dependsOn: a.id }), c = add(), d = add({ dependsOn: 'missing-stage' })
    a.values.dependsOn = b.id
    const plan = stagePlan(project)
    expect(plan.waves).toEqual([[c.id]])
    expect(plan.blockedStageIds).toEqual([a.id, b.id, d.id].sort())
    expect(plan.findings.some(f => f.code === 'STAGE_DEPENDENCY_MISSING')).toBe(true)
  })
  it('requires runtime evidence and timezone-bearing observation time for reported completion', () => {
    const { project, add } = fixture(), stage = add({ status: 'passed', evidence: 'Example evidence', observedAt: '2026-09-10' })
    expect(stagePlan(project).blockedStageIds).toEqual([stage.id])
    stage.values.observedAt = completed.observedAt
    expect(stagePlan(project).stages[0].disposition).toBe('reported-passed')
    stage.values.observedAt = '2026-02-30T12:30:00Z'
    expect(stagePlan(project).stages[0].disposition).toBe('blocked')
    stage.values.observedAt = completed.observedAt
    stage.values.evidence = ''
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_COMPLETION_EVIDENCE')).toBe(true)
  })
  it('requires reviewed failure recovery and never automatically retries', () => {
    const { project, add } = fixture(), stage = add({ status: 'failed' })
    expect(stagePlan(project).stages[0].disposition).toBe('blocked')
    stage.values.evidence = 'Example failure log'; stage.values.rollback = 'Reviewed recovery procedure'
    expect(stagePlan(project).stages[0].disposition).toBe('review-failure')
  })
  it('tracks in-progress work without treating it as stopped or complete', () => {
    const { project, add } = fixture(), running = add({ status: 'running' }), next = add({ dependsOn: running.id })
    const plan = stagePlan(project)
    expect(plan.stages.find(s => s.id === running.id)?.disposition).toBe('in-progress')
    expect(plan.blockedStageIds).toContain(next.id)
  })
  it('requires targets and ownership while leaving external tool references optional', () => {
    const { project, add } = fixture(), stage = add({ executor: 'powershell', targets: '' })
    const codes = stagePlan(project).findings.map(f => f.code)
    expect(codes).toContain('STAGE_TARGETS'); expect(codes).not.toContain('STAGE_CONSUMER')
    stage.values.targets = project.components[0].id; stage.values.consumer = 'Example consumer'; stage.values.version = '1.0.0'; stage.values.runner = 'Example runner'
    const plan = stagePlan(project)
    expect(plan.stages[0].disposition).toBe('handoff-candidate')
    expect(plan.automationReady).toBe(false)
    stage.values.version = 'latest'
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_FLOATING_VERSION')).toBe(false)
    stage.values.version = '1.0.0'
    stage.values.owner = '   '
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_DETAILS')).toBe(true)
    stage.values.owner = 'Example owner'
    stage.values.targets = 'deleted-target'
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_TARGET_MISSING')).toBe(true)
  })
  it('enforces manual OME installation even when the stage is labelled management', () => {
    const { project, add } = fixture(), ome = newComponent('ome'); project.components.push(ome)
    add({ kind: 'management', executor: 'powershell', targets: ome.id, consumer: 'Example', version: '1.0', runner: 'Example' })
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_OME_MANUAL')).toBe(true)
  })
  it('rejects duplicate references and self-dependencies', () => {
    const { project, host, add } = fixture(), stage = add({ targets: `${host.id},${host.id}` })
    stage.values.dependsOn = stage.id
    const codes = stagePlan(project).findings.map(f => f.code)
    expect(codes).toContain('STAGE_DUPLICATE_REFERENCE'); expect(codes).toContain('STAGE_SELF_DEPENDENCY')
  })
  it('checks stage target types and allows active SDN tenant and BGP records', () => {
    const { project, add } = fixture()
    add({ kind: 'cluster' })
    expect(stagePlan(project).findings.some(f => f.code === 'STAGE_TARGET_KIND')).toBe(true)
    const sdn = demoProject(8)
    sdn.design.stages[0].values.targets = JSON.stringify([sdn.design.bgpPeers[0].id, sdn.design.tenantServices[0].id])
    expect(stagePlan(sdn).findings.some(f => f.code === 'STAGE_TARGET_MISSING')).toBe(false)
    sdn.sdn.scope = 'none'
    expect(stagePlan(sdn).findings.filter(f => f.code === 'STAGE_TARGET_MISSING')).toHaveLength(2)
  })
  it('exports deterministic stage plans and preserves the project without mutating observations', () => {
    const { project, add } = fixture(); add(completed)
    const before = serializeProject(project), files = environmentFiles(project)
    expect(JSON.parse(files['plans/stage-plan.json'])).toMatchObject({ executionState: 'not_executed_by_configurator', automationReady: false })
    expect(files).toEqual(environmentFiles(project))
    expect(implementationMarkdown(project)).toContain('reported-passed')
    expect(serializeProject(project)).toBe(before)
  })
  it('remaps stage and target references in sanitized packages', () => {
    const { project, host, add } = fixture(), a = add(completed), b = add({ dependsOn: a.id })
    const shared: Project = parseProject(serializeProject(sanitizeProject(project)))
    expect(parseIds(shared.design.stages[1].values.dependsOn)).toEqual([shared.design.stages[0].id])
    expect(parseIds(shared.design.stages[0].values.targets)).toEqual([shared.components[0].id])
    for (const id of [a.id, b.id, host.id]) expect(JSON.stringify(shared)).not.toContain(id)
  })
})
