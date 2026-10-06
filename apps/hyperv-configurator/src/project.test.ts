import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import { collections, newRecord } from './catalog'
import { componentTotals, newComponent, newProject, parseProject, serializeProject } from './project'
import { demoProject } from './scenarios'
import { cidr, validate } from './validation'
import { designMarkdown, environmentFiles, topology } from './exports'
import { importSurveyor } from './surveyorImport'
import { sanitizeProject } from './sanitize'
import { licenseSummary } from './licensing'

describe('standalone project contract', () => {
  for (let scenario = 1; scenario <= 8; scenario++) {
    it(`preserves every answer and reference in reference scenario ${scenario}`, () => {
      const project = demoProject(scenario)
      expect(parseProject(serializeProject(project))).toEqual(project)
    })
  }
  it('rejects foreign, future and malformed imports before replacing the draft', () => {
    expect(() => parseProject('{')).toThrow('valid')
    expect(() => parseProject(JSON.stringify({ kind: 'hyperv-surveyor-project' }))).toThrow('not a Hyper-V Configurator')
    expect(() => parseProject(JSON.stringify({ ...newProject(), schemaVersion: 100 }))).toThrow('Unsupported')
    const p = demoProject(1)
    expect(() => parseProject(JSON.stringify({ ...p, design: { ...p.design, malicious: [] } }))).toThrow('collections')
    expect(() => parseProject(JSON.stringify({ ...p, scope: 'unknown' }))).toThrow('scope')
  })
  it('rejects prototype keys, duplicate IDs and invalid typed answers', () => {
    expect(() => parseProject(serializeProject(newProject()).replace('"owner": ""', '"owner": "", "__proto__": {}'))).toThrow('unknown field')
    const p = demoProject(1)
    p.components.push(structuredClone(p.components[0]))
    expect(() => serializeProject(p)).toThrow('unique')
    const q = demoProject(7)
    q.design.bgpPeers[0].values.localAsn = '64512'
    expect(() => serializeProject(q)).toThrow('invalid value')
  })
  it('rejects secret literals and accepts runtime references', () => {
    const p = demoProject(6), ome = p.components[0]
    ome.credentialRef = 'literal-password'
    expect(() => serializeProject(p)).toThrow('references')
    ome.credentialRef = 'keyvault://example-vault/ome-credential'
    expect(() => serializeProject(p)).not.toThrow()
    ome.ome.manualSteps = 'password=not-a-real-secret'
    expect(() => serializeProject(p)).toThrow('secret literals')
    const q = demoProject(1)
    q.design.hosts[0].values.bmcCredentialRef = 'unreferenced-value'
    expect(() => serializeProject(q)).toThrow('keyvault')
  })
  it('keeps OME manual, with counted appliance resources', () => {
    const p = demoProject(6)
    expect(componentTotals(p)).toMatchObject({ instances: 1, vCpu: 4, memoryGiB: 16 })
    const files = environmentFiles(p)
    expect(load(files['environment/ome.yml'])).toMatchObject({ installation: 'manual' })
    p.components[0].hostingDetails.installProduct = true
    expect(() => serializeProject(p)).toThrow('manual')
    p.components[0].hostingDetails.installProduct = false
    p.components[0].hosting = 'physical'
    expect(() => serializeProject(p)).toThrow('appliance hosting')
  })
  it('does not discard data when scope changes', () => {
    const p = demoProject(8), saved = structuredClone(p.design.sdnResources)
    p.sdn.scope = 'none'; p.scope = 'management'
    expect(parseProject(serializeProject(p)).design.sdnResources).toEqual(saved)
    expect(load(environmentFiles(p)['environment/sdn.yml'])).not.toHaveProperty('sdnResources')
  })
})

describe('design validation', () => {
  it('blocks stale references after resources are removed', () => {
    const p = demoProject(1)
    p.design.clusters = []
    expect(validate(p).some(f => f.code === 'MISSING_REFERENCE')).toBe(true)
  })
  it('catches preserve/create conflicts and management bootstrap cycles', () => {
    const p = demoProject(4)
    p.components[0].hostingDetails.createInfrastructure = true
    expect(validate(p).some(f => f.code === 'PRESERVE_RESOURCE')).toBe(true)
    p.components[0].lifecycle = 'new'; p.components[0].hosting = 'hyperv-workload'
    expect(validate(p).some(f => f.code === 'BOOTSTRAP_CYCLE')).toBe(true)
  })
  it('checks address overlap only within the same routing scope', () => {
    const p = demoProject(1), network = structuredClone(p.design.networks[0])
    network.id = crypto.randomUUID(); network.values.name = 'Other network'
    p.design.networks.push(network)
    expect(validate(p).some(f => f.code === 'NETWORK_OVERLAP')).toBe(true)
    network.values.routingScope = 'isolated-tenant'
    expect(validate(p).some(f => f.code === 'NETWORK_OVERLAP')).toBe(false)
    network.values.poolStart = '203.0.113.1'
    expect(validate(p).some(f => f.code === 'POOL_RANGE')).toBe(true)
  })
  it('rejects invalid CIDRs and subnet arithmetic edge cases', () => {
    expect(cidr('256.1.1.1/24')).toBeNull()
    expect(cidr('10.0.0.1/33')).toBeNull()
    expect(cidr('10.0.0.1/24')).toEqual({ first: 167772160, last: 167772415, prefix: 24 })
    expect(cidr('0.0.0.0/0')).toEqual({ first: 0, last: 4294967295, prefix: 0 })
  })
  it('distinguishes host-resident controllers from controller VMs', () => {
    const vm = demoProject(7), host = demoProject(8)
    expect(componentTotals(vm).instances).toBe(componentTotals(host).instances + 1)
    expect(componentTotals(vm).memoryGiB).toBe(componentTotals(host).memoryGiB)
    host.design.sdnResources[0].values.role = 'controller'
    expect(validate(host).some(f => f.code === 'SDN_ARCHITECTURE')).toBe(true)
  })
  it('checks stage evidence and prevents automatic OME installation', () => {
    const p = demoProject(6), stage = p.design.stages[0]
    stage.values.kind = 'ome'; stage.values.executor = 'powershell'; stage.values.status = 'passed'
    const codes = validate(p).map(f => f.code)
    expect(codes).toContain('OME_EXECUTOR')
    expect(codes).toContain('EXECUTION_EVIDENCE')
    expect(codes).not.toContain('CONSUMER_CONTRACT')
  })
  it('blocks competing switch owners and insufficient S2D membership', () => {
    const p = demoProject(1)
    const c = collections.find(c => c.key === 'adapters')!
    const a = newRecord(c), b = newRecord(c)
    a.values = { ...a.values, host: p.design.hosts[0].id, switchName: 'compute', authority: 'vmm' }
    b.values = { ...b.values, host: p.design.hosts[0].id, switchName: 'compute', authority: 'atc' }
    p.design.adapters.push(a, b)
    expect(validate(p).some(f => f.code === 'SWITCH_OWNER')).toBe(true)
    p.design.hosts.splice(1); p.design.storageSystems[0].values.kind = 's2d'
    expect(validate(p).some(f => f.code === 'S2D_NODES')).toBe(true)
  })
})

describe('design and handoff exports', () => {
  it('imports Surveyor requirements without inventing deployment identities or duplicating management demand', async () => {
    const input = JSON.stringify({ kind: 'hyperv-surveyor-project', schemaVersion: 4, engineVersion: '1.2.0', payload: { customerName: 'Example import', includeManagementInSizing: true, vms: [{ id: 'original-1', name: 'example-workload', vCpu: 4, ramGiB: 8, storageGiB: 40, include: true }, { name: 'excluded', include: false }], managementDeploymentInputs: { foundation: 'scvmm', monitoring: 'scom', wac: 'none', managedHosts: 4 } } })
    const p = await importSurveyor(input, 'example.json')
    expect(p.design.workloads).toHaveLength(1)
    expect(p.design.hosts).toHaveLength(0)
    expect(componentTotals(p).memoryGiB).toBe(0)
    expect(p.design.imports[0].values.summary).toContain('sizing: yes')
    expect(p.design.imports[0].values.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(parseProject(serializeProject(p))).toEqual(p)
  })
  it('sanitizes customer identities, address plans and original source references', () => {
    const p = demoProject(8)
    p.name = 'Private customer name'
    const shared = sanitizeProject(p)
    const output = serializeProject(shared)
    expect(output).not.toContain('Private customer name')
    expect(output).not.toContain('192.0.2.')
    expect(output).not.toContain('.example.test')
    expect(output).not.toContain(p.design.hosts[0].id)
    expect(parseProject(output).design.hosts[0].values.cluster).toBe(shared.design.clusters[0].id)
    expect(p.name).toBe('Private customer name')
  })
  it('keeps unreviewed pricing unresolved and credits covered quantities', () => {
    const p = demoProject(1), license = p.design.licenses[0]
    expect(licenseSummary(p)[0].estimatedCost).toBeNull()
    license.values = { ...license.values, rights: 'purchase', basis: 'Quoted core units', program: 'Example agreement', context:'internal', customerScope:'Example customer', required: 64, owned: 48, unitPrice: 10, entitlementId:'example-entitlement',entitlementTotalUnits:48,assignmentReview:'Reviewed example assignment',reviewedAt:'2026-01-01',quoteStatus:'quoted',quoteSource:'Example dated quote',quoteDate:'2026-01-01',currency:'USD',term:'perpetual' }
    Object.assign(license.values,{commercialProgram:'commercial',agreementRef:'EXAMPLE agreement',rightsOwner:'Example reviewer',rightsEvidence:'EXAMPLE terms review',entitlementTerm:'perpetual',termStart:'2025-01-01',assignedAt:'2025-01-01',reassignmentBasis:'fixed',mobilityEvidence:'EXAMPLE fixed assignment review',activationMethod:'none',activationEvidence:'EXAMPLE activation decision'})
    expect(licenseSummary(p)[0]).toMatchObject({ purchaseUnits: 16, estimatedCost: 160 })
    license.values.product='sql';license.values.rights = 'included'; license.values.restrictedUse = 'Reviewed applicable supporting SQL runtime rights'
    expect(licenseSummary(p)[0].estimatedCost).toBeNull()
  })
  it('generates deterministic configuration files and honest runtime status', () => {
    const p = demoProject(7)
    const first = environmentFiles(p), second = environmentFiles(p)
    expect(first).toEqual(second)
    for (const [path, text] of Object.entries(first)) if (path.endsWith('.yml')) expect(() => load(text)).not.toThrow()
    expect(JSON.parse(first['validation/results.json']).packagePurpose).toBe('configuration-design')
    expect(load(first['environment/scenario.yml'])).toMatchObject({ deployment_state: 'not_executed_by_configurator' })
  })
  it('includes product, storage, licensing and SDN decisions in reports', () => {
    const p = demoProject(8)
    p.components[0].productDetails.dkm = 'Example DKM container'
    const report = designMarkdown(p)
    for (const expected of ['Example DKM container', 'Thin', 'Datacenter', 'host-cluster-role', 'example-gateway', 'Implementation stages']) expect(report).toContain(expected)
  })
  it('escapes untrusted markup in the report and editable diagram', () => {
    const p = newProject(), c = newComponent('ome')
    c.name = '<script>alert("example")</script>'
    p.components.push(c)
    expect(designMarkdown(p)).not.toContain('<script>')
    expect(topology(p).drawio).toContain('&lt;script&gt;')
    expect(topology(p).svg).not.toContain('<script>')
  })
})
