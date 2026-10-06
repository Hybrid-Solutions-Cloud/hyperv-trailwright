import { describe, it, expect } from 'vitest'
import { collections } from './catalog'
import { collectionApplies } from './collectionScope'
import { demoProject } from './scenarios'
import { networkDeviceKeys } from './componentDecisionFields'

const sanPaths = collections.find(c => c.key === 'sanPaths')!
const record = (values: Record<string, unknown>) => ({ id: crypto.randomUUID(), values })

describe('collection disclosure', () => {
  it('shows SAN I/O paths only when a Fibre Channel or iSCSI storage system exists', () => {
    const project = demoProject(1)
    project.design.sanPaths = []
    project.design.storageSystems = [record({ kind: 's2d' }), record({ kind: 'local' })] as unknown as typeof project.design.storageSystems
    expect(collectionApplies(sanPaths, project)).toBe(false)
    for (const kind of ['fc', 'iscsi']) {
      project.design.storageSystems = [record({ kind: 's2d' }), record({ kind })] as unknown as typeof project.design.storageSystems
      expect(collectionApplies(sanPaths, project), kind).toBe(true)
    }
  })

  it('keeps SAN I/O paths visible while saved paths exist, so no answer is hidden', () => {
    const project = demoProject(1)
    project.design.storageSystems = [record({ kind: 's2d' })] as unknown as typeof project.design.storageSystems
    project.design.sanPaths = [record({ name: 'Retained path' })] as unknown as typeof project.design.sanPaths
    expect(collectionApplies(sanPaths, project)).toBe(true)
  })

  it('hides SDN collections when SDN scope is none and leaves other collections visible', () => {
    const project = demoProject(1)
    project.sdn.scope = 'none'
    const sdn = collections.filter(c => c.section === 'sdn')
    expect(sdn.length).toBeGreaterThan(0)
    for (const collection of sdn) expect(collectionApplies(collection, project)).toBe(false)
    project.sdn.scope = 'new'
    for (const collection of sdn) expect(collectionApplies(collection, project)).toBe(true)
    const gated = new Set(['sanPaths', 'storageLinks', ...networkDeviceKeys])
    for (const collection of collections.filter(c => c.section !== 'sdn' && !gated.has(c.key))) expect(collectionApplies(collection, project), collection.key).toBe(true)
  })

  it('hides gated device collections even when records exist, and shows them only for the matching component option', () => {
    const project = demoProject(1)
    const applies = (key: string) => collectionApplies(collections.find(c => c.key === key)!, project)
    for (const key of networkDeviceKeys) project.design[key] = [record({ name: 'Retained ' + key })] as unknown as typeof project.design.sites
    for (const key of networkDeviceKeys) expect(applies(key), key).toBe(false)
    project.decisions.firewallProvider = 'customer'
    expect(applies('firewallDevices')).toBe(false)
    project.decisions.firewallProvider = 'tierpoint-fortigate'; project.decisions.torProvider = 'customer'; project.decisions.oobModel = 'oob-switch'
    for (const key of ['firewallDevices', 'firewallInterfaces', 'firewallGateways', 'torSwitches', 'oobDevices']) expect(applies(key), key).toBe(true)
    expect(applies('consolePorts')).toBe(false)
    project.decisions.oobModel = 'opengear'
    expect(applies('consolePorts')).toBe(true)
    project.decisions.backupInScope = 'no'; project.decisions.monitoringInScope = 'no'
    expect(applies('recoveryTests')).toBe(false); expect(applies('capacityAlerts')).toBe(false)
  })

  it('shows host storage interfaces only with a SAN storage system or saved interfaces', () => {
    const project = demoProject(1)
    const interfaces = collections.find(c => c.key === 'storageInterfaces')!
    project.design.storageInterfaces = []
    project.design.storageSystems = [record({ kind: 's2d' })] as unknown as typeof project.design.storageSystems
    expect(collectionApplies(interfaces, project)).toBe(false)
    project.design.storageSystems = [record({ kind: 'iscsi' })] as unknown as typeof project.design.storageSystems
    expect(collectionApplies(interfaces, project)).toBe(true)
  })
})
