import type { Component, Project } from './project'
import type { Finding } from './validation'
import { referenceOptions } from './references'
import {placementDomains} from './availabilityDetails'

export interface DependencyOrder { phase: string; waves: string[][]; blocked: string[] }

/** Stable prerequisite-first waves. Blocked resources include cycles and their downstream dependants. */
export function dependencyOrder(project: Project, phase: string): DependencyOrder {
  const valid = new Set(referenceOptions(project, '$resources').map(r => r.id))
  const edges = project.design.dependencies.filter(d => d.values.phase === phase && valid.has(String(d.values.dependent)) && valid.has(String(d.values.prerequisite)))
  const pending = new Map<string, Set<string>>()
  for (const edge of edges) {
    const from = String(edge.values.dependent), to = String(edge.values.prerequisite)
    if (!pending.has(from)) pending.set(from, new Set())
    if (!pending.has(to)) pending.set(to, new Set())
    pending.get(from)!.add(to)
  }
  const waves: string[][] = []
  while (pending.size) {
    const ready = [...pending].filter(([, needs]) => !needs.size).map(([id]) => id).sort()
    if (!ready.length) break
    waves.push(ready)
    for (const id of ready) pending.delete(id)
    for (const needs of pending.values()) for (const id of ready) needs.delete(id)
  }
  return { phase, waves, blocked: [...pending.keys()].sort() }
}

export function managementFindings(project: Project): Finding[] {
  const result: Finding[] = []
  const add = (code: string, message: string, recordId?: string, severity: Finding['severity'] = 'error') => result.push({ code, section: 'hosting', message, recordId, severity })
  const label = (id: string) => referenceOptions(project, '$resources').find(r => r.id === id)?.name || id
  const components = new Map(project.components.map(c => [c.id, c]))
  const groups = project.design.availabilityGroups
  const members = project.design.availabilityMembers
  const dependencies = project.design.dependencies
  const memberships = (id: string) => groups.filter(g => members.some(m => m.values.group === g.id && m.values.component === id))
  const applicationGroups = (id: string) => memberships(id).filter(g => g.values.strategy !== 'providerrestart')

  const duplicateMembers = new Set<string>()
  for (const member of members) {
    const key = `${member.values.group}:${member.values.component}`
    if (duplicateMembers.has(key)) add('HA_DUPLICATE_MEMBER', `${member.values.name || 'Membership'}: the component is listed twice in this availability group.`, member.id)
    duplicateMembers.add(key)
  }

  for (const group of groups) {
    const v = group.values, name = String(v.name || 'Availability group')
    const servers = [...new Set(members.filter(m => m.values.group === group.id && m.values.role !== 'observer').map(m => String(m.values.component)))].map(id => components.get(id)).filter((c): c is Component => !!c)
    if (!v.supportEvidence || !v.reviewedAt) add('HA_SUPPORT_REVIEW', `${name}: record the exact product, OS, provider and topology review with its date.`, group.id, 'warning')
    const reviewedAt = String(v.reviewedAt), parsedDate = new Date(reviewedAt)
    if (reviewedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== reviewedAt)) add('HA_REVIEW_DATE', `${name}: use a valid YYYY-MM-DD support review date.`, group.id)
    if (servers.some(c => v.product !== 'other' && c.product !== v.product)) add('HA_PRODUCT', `${name}: a member's product differs from the protected service.`, group.id)
    if (v.strategy === 'external') {
      if (!v.externalEvidence) add('HA_EXTERNAL_EVIDENCE', `${name}: record the external service owner's availability commitment and evidence.`, group.id)
      continue
    }
    if (!servers.length) add('HA_MEMBERS', `${name}: link component records to this group.`, group.id)
    const expectedProduct: Record<string, string> = { servicecluster: 'vmm', resourcepool: 'scom', sqlfci: 'sql', sqlag: 'sql', filecluster:'library' }
    if (expectedProduct[String(v.strategy)] && v.product !== expectedProduct[String(v.strategy)]) add('HA_STRATEGY_PRODUCT', `${name}: the selected strategy belongs to ${expectedProduct[String(v.strategy)]}. Use a separately reviewed strategy for other services.`, group.id)
    if (v.strategy === 'providerrestart') {
      if (servers.some(c => c.hosting === 'physical' || c.hosting === 'external' || !c.infrastructureHa)) add('HA_PROVIDER_PROTECTION', `${name}: infrastructure restart protection requires a protected VM hosting platform for every member.`, group.id)
      if (!v.antiAffinity) add('HA_PROVIDER_POLICY', `${name}: record the provider's admission control, restart and placement policy.`, group.id)
      continue
    }
    if (servers.length && servers.length < 2) add('HA_REDUNDANCY', `${name}: a redundant service needs separate component records for its members.`, group.id)
    if (servers.some(c => !c.failureDomain.trim())) add('HA_FAILURE_DOMAIN', `${name}: assign each member an explicit failure domain.`, group.id)
    const domainCounts = new Map<string, number>()
    const placement=placementDomains(project,group.id)
    for (const c of servers) if (c.failureDomain.trim()) {
      const key = placement.domains.get(c.id)||c.failureDomain.trim().toLowerCase()
      domainCounts.set(key, (domainCounts.get(key) || 0) + 1)
    }
    const lostDomains = Number(v.failureDomainsLost), minimum = Number(v.minimumActive)
    if (!Number.isInteger(lostDomains) || !Number.isInteger(minimum)) add('HA_INTEGER', `${name}: failure-domain tolerance and minimum active members must be whole numbers.`, group.id)
    const worstLoss = [...domainCounts.values()].sort((a, b) => b - a).slice(0, lostDomains).reduce((a, b) => a + b, 0)
    if (servers.length && minimum > 0 && lostDomains > 0 && servers.length - worstLoss < minimum) add('HA_FAILURE_CAPACITY', `${name}: the worst ${lostDomains} failure-domain loss leaves fewer than ${minimum} required members.`, group.id)
    if (!v.quorum) add('HA_QUORUM', `${name}: specify quorum, witness or resource-pool observer behavior.`, group.id)
    if (!v.antiAffinity) add('HA_PLACEMENT_POLICY', `${name}: record how member separation is enforced.`, group.id)
    if (new Set(servers.map(c => c.version.trim().toLowerCase())).size > 1) add('HA_VERSION_MISMATCH', `${name}: member versions differ. Qualify an explicit supported rolling-upgrade state before handoff.`, group.id)
    if (v.strategy === 'custom') add('HA_CUSTOM_REVIEW', `${name}: custom topology requires independent product qualification.`, group.id, 'warning')
    if (v.strategy === 'servicecluster') {
      for (const c of servers) if (!c.productDetails.dkm || !c.productDetails.serviceAccount || !c.productDetails.serviceName || !c.hostingDetails.domain) add('VMM_HA_PREREQUISITES', `${c.name}: clustered VMM needs a service name, service-account reference, DKM container and domain configuration.`, c.id)
      for (const key of ['dkm', 'serviceAccount', 'serviceName']) if (new Set(servers.map(c => String(c.productDetails[key]).trim().toLowerCase())).size > 1) add('VMM_HA_SHARED_CONFIGURATION', `${name}: VMM members must agree on ${key}.`, group.id)
    }
    if (v.strategy === 'resourcepool') {
      if (servers.some(c => !c.productDetails.managementGroup || !c.productDetails.resourcePools)) add('SCOM_HA_CONFIGURATION', `${name}: specify each server's management group and pool membership.`, group.id)
      if (new Set(servers.map(c => String(c.productDetails.managementGroup).trim().toLowerCase())).size > 1) add('SCOM_MANAGEMENT_GROUP', `${name}: resource-pool members must belong to the same management group.`, group.id)
    }
    if (v.strategy === 'sqlfci' || v.strategy === 'sqlag') {
      const topology = v.strategy === 'sqlfci' ? 'fci' : 'ag'
      if (servers.some(c => c.productDetails.topology !== topology)) add('SQL_HA_TOPOLOGY', `${name}: each SQL member must use the selected ${topology} topology.`, group.id)
      if (servers.some(c => !c.productDetails.replicas || !c.productDetails.backup)) add('SQL_HA_RECOVERY', `${name}: specify replica / node failover behavior and database backup/restore acceptance.`, group.id)
      if (!v.databaseRecovery) add('HA_DATABASE_RECOVERY', `${name}: record database availability and recovery order independently of service failover.`, group.id)
    }
  }

  const seenDependencies = new Set<string>()
  for (const dependency of dependencies) {
    const v = dependency.values, name = String(v.name || 'Dependency')
    if (v.dependent && v.dependent === v.prerequisite) add('DEPENDENCY_SELF', `${name}: a resource cannot be its own prerequisite.`, dependency.id)
    const key = `${v.phase}:${v.kind}:${v.dependent}:${v.prerequisite}`
    if (seenDependencies.has(key)) add('DEPENDENCY_DUPLICATE', `${name}: this dependency is already recorded.`, dependency.id)
    seenDependencies.add(key)
    const target = components.get(String(v.prerequisite))
    const identity = project.design.identities.find(i => i.id === v.prerequisite)
    if (['sql', 'operationalDb', 'warehouseDb'].includes(String(v.kind)) && target && target.product !== 'sql') add('DEPENDENCY_DATABASE_TYPE', `${name}: database dependencies must point to a SQL component.`, dependency.id)
    if (['sql', 'operationalDb', 'warehouseDb'].includes(String(v.kind)) && !target && v.prerequisite) add('DEPENDENCY_DATABASE_TYPE', `${name}: record the SQL service as a component, including existing or externally supplied SQL.`, dependency.id)
    if (v.kind === 'directory' && v.prerequisite && !(target?.product === 'identity' || identity?.values.kind === 'domain')) add('DEPENDENCY_DIRECTORY_TYPE', `${name}: choose an identity/DNS component or domain identity record.`, dependency.id)
    if (v.kind === 'library' && v.prerequisite && target?.product !== 'library') add('DEPENDENCY_LIBRARY_TYPE', `${name}: choose a library service component, including an externally supplied one.`, dependency.id)
    if (v.kind === 'placement' && v.prerequisite && !project.design.hosts.some(h => h.id === v.prerequisite) && !project.design.clusters.some(c => c.id === v.prerequisite)) add('DEPENDENCY_PLACEMENT_TYPE', `${name}: hosting prerequisites must point to a host or cluster.`, dependency.id)
  }
  for (const phase of ['bootstrap', 'runtime', 'recovery']) {
    const order = dependencyOrder(project, phase)
    if (order.blocked.length) add('DEPENDENCY_CYCLE', `${phase}: a dependency cycle blocks ${order.blocked.map(label).join(', ')}. Provide an independent prerequisite path.`, undefined, phase === 'runtime' ? 'warning' : 'error')
  }
  for (const c of project.components) {
    const name = c.name || c.product
    const appHaRequested = !!c.applicationHa.trim() && !/^(none|no |not required|standalone)\b/i.test(c.applicationHa.trim())
    if (appHaRequested && !applicationGroups(c.id).length) add('HA_STRUCTURED_DESIGN', `${name}: link an application availability group; free-text HA or VM restart protection does not define service HA.`, c.id)
    if (project.requirements.managementHa && !memberships(c.id).length) add('HA_SERVICE_DECISION', `${name}: document its availability group or external availability commitment.`, c.id)
    const role=String(c.productDetails.role||'')
    const required = c.product === 'vmm' ? (role==='console'?[]:['sql', 'directory', 'library']) : c.product === 'scom' ? (role==='reporting'?['warehouseDb']:['management',''].includes(role)?['operationalDb', 'warehouseDb', 'directory']:[]) : []
    for (const purpose of required) {
      const links = dependencies.filter(d => d.values.dependent === c.id && d.values.kind === purpose)
      if (!links.length) add('MANAGEMENT_DEPENDENCY', `${name}: link the ${purpose} prerequisite, including an existing or external service when appropriate.`, c.id)
      if (c.lifecycle === 'new' && links.length && !links.some(d => d.values.phase === 'bootstrap')) add('BOOTSTRAP_DEPENDENCY', `${name}: document when the ${purpose} prerequisite becomes available for installation.`, c.id)
      if (appHaRequested || applicationGroups(c.id).length) for (const link of links) {
        if (['sql', 'operationalDb', 'warehouseDb'].includes(purpose) && !applicationGroups(String(link.values.prerequisite)).some(g => ['sqlfci', 'sqlag', 'external'].includes(String(g.values.strategy)))) add('HA_DATABASE_DEPENDENCY', `${name}: its ${purpose} prerequisite needs a separate SQL availability design.`, link.id)
        if(purpose==='library'&&!applicationGroups(String(link.values.prerequisite)).some(g=>['filecluster','external'].includes(String(g.values.strategy))))add('HA_LIBRARY_DEPENDENCY',`${name}: its library prerequisite needs a separate library availability design.`,link.id)
      }
    }
    if (c.hosting === 'hyperv-workload' && c.lifecycle === 'new' && !dependencies.some(d => d.values.dependent === c.id && d.values.kind === 'placement' && d.values.phase === 'bootstrap')) add('BOOTSTRAP_PLACEMENT', `${name}: link its hosting cluster in the bootstrap graph so self-hosting cycles can be checked.`, c.id)
  }
  return result
}
