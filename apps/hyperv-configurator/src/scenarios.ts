import { collections, newRecord, type Answers } from './catalog'
import { newComponent, newProject, type Component, type Project } from './project'

export function demoProject(scenario: number): Project {
  if (!Number.isInteger(scenario) || scenario < 1 || scenario > 8) throw new Error('Choose reference scenario 1–8.')
  const p = newProject()
  p.name = `Reference ${scenario} — fictional Hyper-V design`
  p.owner = 'Example engineering team'
  p.environment = 'lab'
  const add = (key: string, values: Answers) => {
    const row = newRecord(collections.find(c => c.key === key)!)
    row.values = { ...row.values, owner: p.owner, ...values }
    p.design[key].push(row)
    return row.id
  }
  const component = (product: Component['product'], name: string) => {
    const c = newComponent(product)
    c.name = name; c.owner = p.owner; c.version = 'Select and verify exact build'
    c.placement = 'Example management fabric'; c.vCpu = 4; c.memoryGiB = 16; c.diskGiB = 120
    p.components.push(c)
    return c
  }
  const site = add('sites', { name: 'Example site', code: 'EX1', datacenter: 'Example datacenter', racks: 'Rack A; Rack B' })
  const cluster = add('clusters', { name: 'example-hv', site, lifecycle: scenario === 4 ? 'create' : 'configure', topology: 'cluster', os: 'ws2025', edition: 'datacenter', startingState: scenario === 2 ? 'baremetal' : 'ready', intent: scenario === 2 ? 'vmm' : 'handoff', authority: scenario === 2 || scenario === 4 ? 'vmm' : 'native', reserveNodes: 1, bootstrap: 'Management remains on an independently available fabric.' })
  for (let i = 1; i <= 2; i++) add('hosts', { name: `example-hv0${i}`, fqdn: `example-hv0${i}.example.test`, cluster, lifecycle: scenario === 2 ? 'create' : 'preserve', serial: `EXAMPLE-ONLY-${i}`, managementIp: `192.0.2.${10 + i}`, rack: i === 1 ? 'Rack A' : 'Rack B', sockets: 2, coresPerSocket: 16, memoryGiB: 256 })
  add('networks', { name: 'Example management', site, purpose: 'management', routingScope: 'management', cidr: '192.0.2.0/24', vlan: 100, gateway: '192.0.2.1', poolStart: '192.0.2.10', poolEnd: '192.0.2.200', authority: 'native', mtu: 1500 })
  const system = add('storageSystems', { name: 'Example SAN', cluster, kind: 'fc', rawTiB: 40, usableTiB: 20, reserveTiB: 4, fabrics: 'Separate fabric A and B; zoning owned by storage team.' })
  add('volumes', { name: 'Example CSV01', system, path: 'C:\\ClusterStorage\\Volume1', sizeGiB: 4096, usedGiB: 2048, provisioning: 'thin', filesystem: 'refs', resiliency: 'external' })
  if (scenario === 5) {
    p.requirements.offline = true; p.requirements.browserAdmin = true
    component('wac', 'example-wac').productDetails.mode = 'administration'
  } else {
    const vmm = component('vmm', 'example-vmm'), sql = component('sql', 'example-sql')
    sql.productDetails.edition = 'standard'; sql.productDetails.topology = 'standalone'
    vmm.productDetails.sql = sql.name
    if (scenario === 1) for (const c of p.components) { c.hosting = 'vcd'; c.lifecycle = 'configure'; c.hostingDetails.configureGuest = true; c.hostingDetails.installProduct = true; c.hostingDetails.resourcePool = 'Example Org VDC' }
    if (scenario === 3) for (const c of p.components) { c.hosting = 'physical'; c.vCpu = 0 }
    if (scenario === 4) { p.scope = 'cluster'; for (const c of p.components) c.lifecycle = 'preserve' }
    if (scenario === 2) {
      p.requirements.bareMetal = true; p.requirements.managementHa = true; p.requirements.monitoring = true
      vmm.applicationHa = 'Clustered VMM service; verify exact support prerequisites'
      sql.productDetails.topology = 'fci'
      component('vmm', 'example-vmm-peer').failureDomain = 'Rack B'
      component('scom', 'example-scom')
      const profile = add('profiles', { name: 'Example VMM profile', method: 'vmm', profileState: 'create', vmmEndpoint: 'example-vmm.example.test', os: 'ws2025', installType: 'core', hostGroup: 'All Hosts / Example', libraryPath: '\\\\example-library\\images\\ws2025.vhdx' })
      for (const h of p.design.hosts) h.values.profile = profile
    }
  }
  if (scenario === 6) {
    p.scope = 'management'
    p.components = []
    const ome = component('ome', 'example-ome')
    ome.hosting = 'vsphere'
    ome.ome = { devices: 100, plugins: 'Choose supported plugins', discoveryScope: 'Example iDRAC device group; fill explicit bounded ranges', firmwareCatalog: 'Qualified vendor catalog reference', integrations: 'Review required plugins and integration versions', entitlement: 'Review existing advanced feature / plugin rights', manualSteps: 'Import supported appliance image; complete first boot; configure certificates; license; discover devices; validate integrations.' }
  }
  if (scenario === 7 || scenario === 8) {
    p.sdn = { ...p.sdn, scope: 'new', owner: scenario === 7 ? 'vmm' : 'powershell', architecture: scenario === 7 ? 'controller-vms' : 'host-cluster-role', osVersion: 'Windows Server 2025 — select build', toolVersion: 'Qualification required', controllerEndpoint: 'nc.example.test', underlay: 'Example provider network; verify physical routing and MTU', certificates: 'Enterprise PKI; verify subject, SAN, trust and renewal', loadBalancer: true, gateways: true }
    add('sdnResources', { name: 'example-nc', role: scenario === 7 ? 'controller' : 'hostcontroller', lifecycle: 'create', cluster, vCpu: 4, memoryGiB: 8, diskGiB: scenario === 7 ? 80 : 0 })
    add('sdnResources', { name: 'example-mux', role: 'mux', lifecycle: 'create', cluster, vCpu: 4, memoryGiB: 8, diskGiB: 80 })
    add('sdnResources', { name: 'example-gateway', role: 'gateway', lifecycle: 'create', cluster, vCpu: 4, memoryGiB: 8, diskGiB: 80 })
    add('bgpPeers', { name: 'Example edge', localIp: '198.51.100.2', remoteIp: '198.51.100.1', localAsn: 64512, remoteAsn: 64513 })
    const tenant = add('networks', { name: 'Example isolated tenant', purpose: 'tenant', routingScope: 'example-tenant-a', cidr: '10.0.0.0/24', authority: 'vmm' })
    add('tenantServices', { name: 'Example tenant network', tenantId: 'example-tenant-a', network: tenant, service: 'network', policy: 'Specify required traffic and isolation tests.' })
  }
  add('licenses', { name: 'Example Windows coverage', product: 'windows', edition: 'Datacenter', context: 'internal', rights: 'review', required: 64, owned: 0, currency: 'USD', term: 'perpetual', evidence: 'Fictional example. Verify licensing basis, existing entitlements and quote.' })
  add('operations', { name: 'Example platform operations', scope: 'Hyper-V and management dependencies', rtoMinutes: 240, rpoMinutes: 60, restore: 'Define recovery sequence and test evidence.' })
  add('stages', { name: 'Design and prerequisite review', order: 1, kind: 'prerequisite', executor: 'operator', acceptance: 'Review required inputs, supported versions, target scope and resource owners.', status: 'planned' })
  return p
}
