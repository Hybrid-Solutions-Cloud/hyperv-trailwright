import { removeStorageV7 } from './testing/legacyStorage'
import { quorumFields } from './quorumConfiguration'
import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import { collections, newRecord, type Answers } from './catalog'
import { newProject, newComponent, parseProject, serializeProject, componentTotals, type Project } from './project'
import { dependencyOrder, managementFindings } from './managementValidation'
import { validate } from './validation'
import { environmentFiles, designMarkdown, topology } from './exports'
import { sanitizeProject } from './sanitize'
import { demoProject } from './scenarios'

function add(p: Project, key: string, values: Answers) {
  const row = newRecord(collections.find(c => c.key === key)!)
  row.values = { ...row.values, name: `${key}-${p.design[key].length + 1}`, owner: 'Example owner', ...values }
  p.design[key].push(row)
  return row
}
function clusterFixture() {
  const p = newProject()
  const a = newComponent('sql'), b = newComponent('sql')
  for (const [index, c] of [a, b].entries()) {
    c.name = `sql-${index + 1}`; c.version = 'SQL 2022 CU sample'; c.failureDomain = `Rack ${index + 1}`
    c.memoryGiB = 32; c.diskGiB = 400
    c.productDetails.topology = 'fci'; c.productDetails.replicas = 'Qualified failover design'; c.productDetails.backup = 'Restore acceptance'
  }
  p.components = [a, b]
  const group = add(p, 'availabilityGroups', { product: 'sql', strategy: 'sqlfci', endpoint: 'sql.example.test', minimumActive: 1, failureDomainsLost: 1, quorum: 'Independent witness', antiAffinity: 'Separate racks', recovery: 'Test recovery', databaseRecovery: 'Databases before services', supportEvidence: 'Example review', reviewedAt: '2026-09-10' })
  for (const c of p.components) add(p, 'availabilityMembers', { group: group.id, component: c.id, role: 'active' })
  return { p, a, b, group }
}

describe('availability and bootstrap design', () => {
  it('detects a VMM bootstrap cycle and preserves unrelated prerequisite ordering', () => {
    const p = newProject(), vmm = newComponent('vmm'), identity = newComponent('identity')
    p.components = [vmm, identity]
    const cluster = add(p, 'clusters', {})
    add(p, 'dependencies', { dependent: vmm.id, prerequisite: cluster.id, phase: 'bootstrap', kind: 'placement' })
    add(p, 'dependencies', { dependent: cluster.id, prerequisite: vmm.id, phase: 'bootstrap', kind: 'provisioning' })
    add(p, 'dependencies', { dependent: vmm.id, prerequisite: identity.id, phase: 'bootstrap', kind: 'directory' })
    expect(dependencyOrder(p, 'bootstrap')).toMatchObject({ waves: [[identity.id]], blocked: [cluster.id, vmm.id].sort() })
    expect(managementFindings(p).some(f => f.code === 'DEPENDENCY_CYCLE' && f.severity === 'error')).toBe(true)
    p.design.dependencies.splice(1, 1)
    const order = dependencyOrder(p, 'bootstrap')
    expect(order.blocked).toEqual([])
    expect(order.waves[1]).toEqual([vmm.id])
  })
  it('checks cold-start cycles even for preserved services', () => {
    const p = newProject(), a = newComponent('identity'), b = newComponent('pki')
    a.lifecycle = b.lifecycle = 'preserve'; p.components = [a, b]
    add(p, 'dependencies', { dependent: a.id, prerequisite: b.id, phase: 'recovery', kind: 'certificate' })
    add(p, 'dependencies', { dependent: b.id, prerequisite: a.id, phase: 'recovery', kind: 'directory' })
    expect(dependencyOrder(p, 'bootstrap').blocked).toEqual([])
    expect(dependencyOrder(p, 'recovery').blocked).toHaveLength(2)
  })
  it('is deterministic when records are reordered and counts shared prerequisites once', () => {
    const p = newProject()
    p.components = ['identity', 'vmm', 'scom'].map(product => newComponent(product as 'identity' | 'vmm' | 'scom'))
    for (const c of p.components.slice(1)) add(p, 'dependencies', { dependent: c.id, prerequisite: p.components[0].id, phase: 'bootstrap' })
    const first = dependencyOrder(p, 'bootstrap')
    p.design.dependencies.reverse(); p.components.reverse()
    expect(dependencyOrder(p, 'bootstrap')).toEqual(first)
    expect(first.waves.map(w => w.length)).toEqual([1, 2])
  })
  it('requires explicit database and directory references without creating resources', () => {
    const p = newProject(), c = newComponent('vmm'); p.components.push(c)
    const before = serializeProject(p)
    expect(managementFindings(p).filter(f => f.code === 'MANAGEMENT_DEPENDENCY')).toHaveLength(3)
    expect(serializeProject(p)).toBe(before)
  })
  it('rejects database links to the wrong product and catches deleted references', () => {
    const p = newProject(), c = newComponent('vmm'), wrong = newComponent('wac'); p.components = [c, wrong]
    add(p, 'dependencies', { dependent: c.id, prerequisite: wrong.id, phase: 'bootstrap', kind: 'sql' })
    expect(validate(p).some(f => f.code === 'DEPENDENCY_DATABASE_TYPE')).toBe(true)
    p.components.pop()
    expect(validate(p).some(f => f.code === 'MISSING_REFERENCE')).toBe(true)
  })
  it('accepts separate SQL members and does not double-count group membership', () => {
    const { p } = clusterFixture()
    expect(managementFindings(p)).toEqual([])
    expect(componentTotals(p)).toMatchObject({ instances: 2, memoryGiB: 64, diskGiB: 800 })
  })
  it('detects case-insensitive shared failure domains and missing member separation', () => {
    const { p, a, b } = clusterFixture()
    b.failureDomain = a.failureDomain.toUpperCase()
    expect(managementFindings(p).some(f => f.code === 'HA_FAILURE_CAPACITY')).toBe(true)
    b.failureDomain = ''
    expect(managementFindings(p).some(f => f.code === 'HA_FAILURE_DOMAIN')).toBe(true)
  })
  it('accounts for the largest domain loss rather than just the number of racks', () => {
    const { p, a, group } = clusterFixture(), third = structuredClone(a)
    third.id = crypto.randomUUID(); third.name = 'sql-third'; p.components.push(third)
    add(p, 'availabilityMembers', { group: group.id, component: third.id, role: 'passive' })
    group.values.minimumActive = 2
    expect(managementFindings(p).some(f => f.code === 'HA_FAILURE_CAPACITY')).toBe(true)
  })
  it('does not equate protected VMs with an available management application', () => {
    const { p, a, b, group } = clusterFixture()
    a.infrastructureHa = b.infrastructureHa = true; a.applicationHa = 'SQL service HA'
    group.values.strategy = 'providerrestart'
    expect(managementFindings(p).some(f => f.code === 'HA_STRUCTURED_DESIGN')).toBe(true)
  })
  it('requires external HA commitments without inventing replicas', () => {
    const p = newProject(), c = newComponent('sql'); c.hosting = 'external'; c.lifecycle = 'external'; p.components.push(c)
    const group = add(p, 'availabilityGroups', { product: 'sql', strategy: 'external', endpoint: 'shared.example.test', recovery: 'Owner restores service', supportEvidence: 'Example', reviewedAt: '2026-09-10' })
    add(p, 'availabilityMembers', { group: group.id, component: c.id, role: 'active' })
    expect(managementFindings(p).map(f => f.code)).toEqual(['HA_EXTERNAL_EVIDENCE'])
    group.values.externalEvidence = 'Existing service owner and availability commitment'
    expect(managementFindings(p)).toEqual([])
    expect(validate(p).filter(f => f.recordId === group.id && f.code === 'RANGE')).toEqual([])
  })
  it('requires separately designed SQL HA for a clustered VMM application', () => {
    const { p, a, group } = clusterFixture(), vmm = newComponent('vmm')
    vmm.applicationHa = 'Clustered service'; p.components.push(vmm)
    add(p, 'dependencies', { dependent: vmm.id, prerequisite: a.id, kind: 'sql', phase: 'bootstrap' })
    expect(managementFindings(p).some(f => f.code === 'HA_DATABASE_DEPENDENCY')).toBe(false)
    group.values.strategy = 'providerrestart'
    expect(managementFindings(p).some(f => f.code === 'HA_DATABASE_DEPENDENCY')).toBe(true)
  })
  it('checks shared VMM configuration and SQL edition/topology separation', () => {
    const { p, a, b, group } = clusterFixture()
    a.product = b.product = 'vmm'; group.values.product = 'vmm'; group.values.strategy = 'servicecluster'
    a.productDetails = newComponent('vmm').productDetails; b.productDetails = newComponent('vmm').productDetails
    a.productDetails.dkm = 'Example DKM'; b.productDetails.dkm = 'Different DKM'
    const codes = managementFindings(p).map(f => f.code)
    expect(codes).toContain('VMM_HA_PREREQUISITES'); expect(codes).toContain('VMM_HA_SHARED_CONFIGURATION')
  })
  it('rejects duplicate memberships, invalid dates and fractional tolerance', () => {
    const { p, group } = clusterFixture()
    add(p, 'availabilityMembers', { ...p.design.availabilityMembers[0].values })
    group.values.reviewedAt = '2026-02-30'; group.values.failureDomainsLost = 1.5
    const codes = managementFindings(p).map(f => f.code)
    for (const code of ['HA_DUPLICATE_MEMBER', 'HA_REVIEW_DATE', 'HA_INTEGER']) expect(codes).toContain(code)
  })
})

describe('schema migration and availability exports', () => {
  it('upgrades actual v1-shaped projects without inventing availability or changing answers', () => {
    const current = demoProject(2), legacy = JSON.parse(serializeProject(current))
    removeStorageV7(legacy);legacy.schemaVersion = 1; delete legacy.discovery
    for (const key of ['availabilityGroups', 'availabilityMembers', 'dependencies']) delete legacy.design[key]
    for (const row of legacy.design.hosts) for (const key of ['managementAdapter', 'bmcRunAsId']) delete row.values[key]
    for (const row of legacy.design.profiles) for (const key of ['vmmModuleVersion', 'hostGroupId', 'logicalNetworkId']) delete row.values[key]
    for (const row of legacy.design.clusters) for (const key of ['clusterModuleVersion','seedHost','domainFqdn','managementNetwork']) delete row.values[key]
    for (const row of legacy.design.clusters) for (const key of quorumFields) delete row.values[key]
    const migrated = parseProject(JSON.stringify(legacy))
    expect(migrated.schemaVersion).toBe(32)
    expect(migrated.components).toEqual(current.components)
    expect(migrated.design.hosts).toEqual(current.design.hosts)
    expect(migrated.design.availabilityGroups).toEqual([])
    expect(migrated.id).toBe(current.id); expect(migrated.revision).toBe(current.revision)
  })
  it('rejects missing v2 collections and smuggled new fields in v1', () => {
    const legacy = JSON.parse(serializeProject(newProject()))
    removeStorageV7(legacy);legacy.schemaVersion = 1; delete legacy.discovery
    expect(() => parseProject(JSON.stringify(legacy))).toThrow('Schema 1')
    removeStorageV7(legacy);legacy.schemaVersion = 2; delete legacy.design.dependencies
    expect(() => parseProject(JSON.stringify(legacy))).toThrow('inventory')
  })
  it('includes stable dependency IDs, named reports and membership topology in exports', () => {
    const { p, a, group } = clusterFixture()
    add(p, 'dependencies', { dependent: a.id, prerequisite: p.components[1].id, phase: 'bootstrap', kind: 'generic', acceptance: 'Example readiness' })
    const files = environmentFiles(p)
    expect(load(files['environment/availability.yml'])).toMatchObject({ availabilityGroups: [{ id: group.id }] })
    const plan = JSON.parse(files['plans/dependency-order.json'])
    expect(plan.executionState).toBe('not_executed_by_configurator')
    expect(plan.phases).toEqual([{ phase: 'bootstrap', waves: [[p.components[1].id], [a.id]], blocked: [] }, { phase: 'runtime', waves: [], blocked: [] }, { phase: 'recovery', waves: [], blocked: [] }])
    expect(designMarkdown(p)).toContain('sql-1 (sql)')
    expect(topology(p).drawio).toContain(`source="n:${group.id}" target="n:${a.id}"`)
    expect(files).toEqual(environmentFiles(p))
  })
  it('remaps shared dependencies and members in sanitized reopenable projects', () => {
    const { p, a, b, group } = clusterFixture()
    add(p, 'dependencies', { dependent: a.id, prerequisite: b.id, phase: 'recovery', kind: 'generic' })
    const shared = parseProject(serializeProject(sanitizeProject(p)))
    expect(JSON.stringify(shared)).not.toContain(group.id)
    expect(shared.design.dependencies[0].values.dependent).toBe(shared.components[0].id)
    expect(shared.design.availabilityMembers[0].values.component).toBe(shared.components[0].id)
    expect(shared.design.availabilityMembers[0].values.group).toBe(shared.design.availabilityGroups[0].id)
  })
})
