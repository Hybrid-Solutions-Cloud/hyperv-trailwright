import {quorumConfiguration} from './quorumConfiguration'
import {sdnPlan} from './sdnPlan'
import { collections, visibleField } from './catalog'
import { type Project } from './project'
import { referenceOptions } from './references'
import { managementFindings } from './managementValidation'
import { stagePlan } from './stagePlan'
import { ipv4, cidr, dnsOrIpv4 } from './networkAddress'
export { ipv4, cidr } from './networkAddress'
import { vmmProfilePlan } from './vmmProfile'
import { storagePlan } from './storagePlan'
import { licensingPlan } from './licensing'
import { workflowFindings } from './workflow'
import {managementAdvice} from './managementAdvisor'
import {omePlan} from './omePlan'
import {managementProductPlan} from './managementProductPlan'
import {hostingPlan} from './hostingPlan'
import {omissionFindings} from './componentOmissions'
import {availabilityPlan} from './availabilityPlan'
import {recordFields} from './availabilityDetailFields'
import {prerequisitePlan} from './prerequisitePlan'
import {hostDeploymentPlan} from './hostDeploymentPlan'
import {networkDesign} from './networkDesign'
import {operationsPlan} from './operationsPlan'
import {collectionApplies} from './collectionScope'
import {decisionFindings} from './componentDecisions'

export interface Finding { code: string; section: string; recordId?: string; fieldKey?: string; severity: 'error' | 'warning'; message: string }
export function validate(project: Project): Finding[] {
  const findings: Finding[] = []
  const add = (code: string, section: string, message: string, recordId?: string, severity: Finding['severity'] = 'error', fieldKey?: string) => findings.push({ code, section, message, recordId, severity, ...(fieldKey ? {fieldKey} : {}) })
  if (!project.name.trim()) add('PROJECT_NAME', 'project', 'Give the design a name.')
  if (!project.owner.trim()) add('PROJECT_OWNER', 'project', 'Assign a design owner.')
  findings.push(...workflowFindings(project))
  findings.push(...managementAdvice(project).findings)
  findings.push(...omePlan(project).appliances.flatMap(a=>a.findings))
  findings.push(...managementProductPlan(project).findings)
  findings.push(...hostingPlan(project).findings)
  findings.push(...omissionFindings(project))
  findings.push(...availabilityPlan(project).findings)
  findings.push(...prerequisitePlan(project).findings)
  findings.push(...hostDeploymentPlan(project).findings)
  findings.push(...networkDesign(project).findings)
  findings.push(...operationsPlan(project).findings)
  findings.push(...decisionFindings(project))

  const seenNames = new Map<string, string>()
  for (const c of project.components) {
    const name = c.name || c.product
    if (!c.name || !c.owner || !c.version || !c.placement) add('COMPONENT_DETAILS', 'hosting', `${name}: name, owner, version and placement are required.`, c.id)
    if (c.name && seenNames.has(c.name.toLowerCase())) add('DUPLICATE_NAME', 'hosting', `${name}: duplicate component name.`, c.id)
    seenNames.set(c.name.toLowerCase(), c.id)
    if (c.hosting !== 'external' && (!c.memoryGiB || !c.diskGiB)) add('COMPONENT_CAPACITY', 'hosting', `${name}: record memory and disk capacity.`, c.id)
    if (c.lifecycle === 'preserve' && (c.hostingDetails.createInfrastructure || c.hostingDetails.installProduct)) add('PRESERVE_RESOURCE', 'hosting', `${name}: preserving an existing resource conflicts with creation or installation.`, c.id)
    if (c.product === 'vmm' && c.hosting === 'hyperv-workload' && c.lifecycle === 'new' && !c.hostingDetails.bootstrap) add('BOOTSTRAP_CYCLE', 'hosting', `${name}: provide an independent bootstrap path.`, c.id)
    if (c.product === 'arc' && project.requirements.offline) add('OFFLINE_ARC', 'management', `${name}: Azure-dependent operations cannot satisfy offline management.`, c.id)
    if (c.product === 'ome') {
      if (c.hosting === 'physical' || c.hostingDetails.installProduct) add('OME_MANUAL', 'hosting', `${name}: OME requires a supported appliance platform and manual installation.`, c.id)
      if (!c.ome.manualSteps || !c.ome.entitlement || !c.ome.discoveryScope) add('OME_HANDOFF', 'products', `${name}: record appliance setup tasks, entitlement and discovery scope.`, c.id)
    }
    if (!c.hostingDetails.supportEvidence) add('COMPATIBILITY_REVIEW', 'hosting', `${name}: verify the selected OS, product, hosting and HA combination.`, c.id, 'warning')
    if (c.product === 'sql' && c.productDetails.edition === 'developer' && (project.environment === 'production' || project.environment === 'hosted')) add('SQL_DEVELOPER', 'products', `${name}: Developer edition cannot be used for production workloads.`, c.id)
  }
  const duplicate = new Map<string, string>()
  for (const collection of collections) {
    if (!collectionApplies(collection, project)) continue
    for (const row of project.design[collection.key]) {
      const v = row.values, name = String(v.name || collection.singular)
      for (const field of recordFields(project,collection,v).filter(f => visibleField(f, v))) {
        const value = v[field.key]
        if (field.required && (typeof value==='string'?!value.trim():value===undefined)) add('REQUIRED', collection.section, `${name}: ${field.label} is required.`, row.id, 'error', field.key)
        if (typeof value === 'number' && value < (field.min ?? 0)) add('RANGE', collection.section, `${name}: ${field.label} must be at least ${field.min}.`, row.id, 'error', field.key)
        if (typeof value === 'number' && field.max !== undefined && value > field.max) add('RANGE_MAX', collection.section, `${name}: ${field.label} must be no more than ${field.max}.`, row.id, 'error', field.key)
        if (field.collection && value && !referenceOptions(project, field.collection).some(r => r.id === value)) add('MISSING_REFERENCE', collection.section, `${name}: ${field.label} references a removed record.`, row.id, 'error', field.key)
        if (['managementIp', 'localIp', 'remoteIp', 'wanIp', 'gatewayIp'].includes(field.key) && value && ipv4(String(value)) === null) add('IP_ADDRESS', collection.section, `${name}: ${field.label} must be an IPv4 address.`, row.id, 'error', field.key)
        if (field.key==='bmcAddress'&&value&&!dnsOrIpv4(String(value)))add('BMC_ADDRESS',collection.section,`${name}: ${field.label} must be a DNS name or IPv4 address.`,row.id,'error',field.key)
        if (['mac', 'pxeMac'].includes(field.key) && value && !/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(String(value))) add('MAC_ADDRESS', collection.section, `${name}: invalid MAC address.`, row.id, 'error', field.key)
      }
      for (const key of ['fqdn', 'serial', 'uuid', 'mac']) {
        if(collection.key==='managementNetworks'&&key==='mac')continue
        if (!v[key]) continue
        const id = `${collection.key}:${key}:${String(v[key]).toLowerCase()}`
        if (duplicate.has(id)) add('DUPLICATE_IDENTITY', collection.section, `${name}: duplicate ${key}.`, row.id)
        duplicate.set(id, row.id)
      }
      if (collection.key === 'hosts' && v.lifecycle === 'replace' && !v.reimageScope) add('REIMAGE_SCOPE', 'hardware', `${name}: specify approved replacement scope and preservation checks.`, row.id)
      if (collection.key === 'stages') {
        if (v.kind === 'ome' && v.executor !== 'operator') add('OME_EXECUTOR', 'automation', `${name}: OME installation must remain a manual operator task.`, row.id)
        if (v.status === 'passed' && (!v.evidence || !v.observedAt)) add('EXECUTION_EVIDENCE', 'automation', `${name}: a passed stage requires runtime evidence and observation time.`, row.id)
      }
      if (collection.key === 'media' && v.sha256 && !/^[a-f0-9]{64}$/i.test(String(v.sha256))) add('ARTIFACT_HASH', 'identity', `${name}: SHA-256 must contain 64 hexadecimal characters.`, row.id)
    }
  }

  for (const cluster of project.design.clusters) {
    const members = project.design.hosts.filter(h => h.values.cluster === cluster.id)
    if (!members.length) add('CLUSTER_MEMBERS', 'hardware', `${cluster.values.name || 'Cluster'}: add physical host records.`, cluster.id)
    if (Number(cluster.values.reserveNodes) >= members.length && members.length) add('FAILURE_RESERVE', 'topology', `${cluster.values.name}: reserve leaves no running host capacity.`, cluster.id)
  }
  for (const row of project.design.adapters) {
    const peers = project.design.adapters.filter(p => p.id !== row.id && p.values.host === row.values.host && p.values.switchName && p.values.switchName === row.values.switchName)
    if (peers.some(p => p.values.authority && row.values.authority && p.values.authority !== row.values.authority)) add('SWITCH_OWNER', 'network', `${row.values.switchName}: a switch must have one configuration owner.`, row.id)
  }
  const networks = project.design.networks
  for (let i = 0; i < networks.length; i++) {
    const network = networks[i], v = network.values, range = cidr(String(v.cidr))
    if (!range) { if (v.cidr) add('CIDR', 'network', `${v.name || 'Network'}: enter a valid IPv4 CIDR.`, network.id); continue }
    for (const key of ['gateway', 'poolStart', 'poolEnd']) {
      if (!v[key]) continue
      const address = ipv4(String(v[key]))
      if (address === null || address < range.first || address > range.last) add('POOL_RANGE', 'network', `${v.name}: ${key} is outside the subnet.`, network.id)
    }
    if (v.poolStart && v.poolEnd && (ipv4(String(v.poolStart)) ?? 0) > (ipv4(String(v.poolEnd)) ?? 0)) add('POOL_ORDER', 'network', `${v.name}: pool start is after its end.`, network.id)
    for (const other of networks.slice(i + 1)) {
      const otherRange = cidr(String(other.values.cidr))
      if (otherRange && v.routingScope && v.routingScope === other.values.routingScope && range.first <= otherRange.last && otherRange.first <= range.last) add('NETWORK_OVERLAP', 'network', `${v.name} overlaps ${other.values.name} in routing scope ${v.routingScope}.`, network.id)
    }
  }
  findings.push(...sdnPlan(project).findings)
  const combined=[...findings, ...quorumConfiguration(project).findings, ...storagePlan(project).findings, ...licensingPlan(project).findings, ...managementFindings(project), ...stagePlan(project).findings, ...vmmProfilePlan(project).findings]
  const seen=new Set<string>()
  return combined.filter(f=>{const key=JSON.stringify([f.code,f.recordId,f.fieldKey,f.severity,f.message]);if(seen.has(key))return false;seen.add(key);return true})
}
