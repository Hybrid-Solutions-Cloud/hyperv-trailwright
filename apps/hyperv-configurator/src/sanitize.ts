import { collections, hostingFields, productFields, type Answers, type Field } from './catalog'
import type { Project } from './project'
import { parseIds } from './stagePlan'
import {sdnFabricFields} from './sdnFields'
import {decisionFields,decisionSecretKeys} from './componentDecisionFields'

/** Sharing exports preserve architecture and quantities, replacing free-text inventory and identities. */
export function sanitizeProject(project: Project): Project {
  const result = structuredClone(project)
  // Remove unsigned source inventory and review history, including external IDs and hashes.
  result.discovery = { snapshots: [], reviews: [] }
  result.sdnEvidence={entries:[]}
  const ids = new Map<string, string>()
  let index = 0
  const componentRecords=[...result.components,...result.omittedComponents.map(row=>row.component)]
  for (const c of componentRecords) ids.set(c.id, `component-${++index}`)
  for (const c of collections) for (const row of result.design[c.key]) ids.set(row.id, `${c.key}-${++index}`)
  const scrub = (answers: Answers, fields: Field[]) => Object.fromEntries(fields.map(f => {
    const value = answers[f.key]
    if (['targets', 'dependsOn'].includes(f.key)) {
      try { return [f.key, value ? JSON.stringify(parseIds(value).map(id => ids.get(id)).filter(Boolean)) : ''] }
      catch { return [f.key, ''] }
    }
    if (f.type === 'reference') return [f.key, value ? ids.get(String(value)) || '' : '']
    if (f.type === 'select' || typeof value !== 'string' || !value) return [f.key, value]
    return [f.key, /Ref$/.test(f.key) ? 'secret-ref://withheld/reference' : 'Withheld for sharing']
  }))
  result.id = 'shared-design'; result.name = 'Shared Hyper-V design'; result.owner = 'Withheld for sharing'
  result.sdn.details=scrub(result.sdn.details,sdnFabricFields)
  result.decisions=scrub(result.decisions,decisionFields)
  for(const key of decisionSecretKeys)if(result.decisions[key])result.decisions[key]='secret-ref://withheld/reference'
  for(const key of ['scenarioId','customer','naming','supportTarget','managementOwner','managementEvidence'] as const)result.context[key]=result.context[key]?'Withheld for sharing':''
  for(const key of ['decisionOwner','decisionEvidence','provisioningContract','tenantInterface','integrationRequirements','migrationPlan'] as const)result.managementPlan[key]=result.managementPlan[key]?'Withheld for sharing':''
  for(const row of result.omittedComponents){row.reason=row.reason?'Withheld for sharing':'';row.reviewOwner=row.reviewOwner?'Withheld for sharing':''}
  for (const c of componentRecords) {
    c.id = ids.get(c.id)!; c.name = c.id; c.owner = 'Withheld for sharing'
    for (const key of ['version', 'placement', 'failureDomain', 'endpoint', 'applicationHa', 'recovery'] as const) c[key] = c[key] ? 'Withheld for sharing' : ''
    c.credentialRef = c.credentialRef ? 'secret-ref://withheld/reference' : ''
    c.hostingDetails = scrub(c.hostingDetails, hostingFields); c.productDetails = scrub(c.productDetails, productFields[c.product])
    for (const key of ['plugins', 'discoveryScope', 'firmwareCatalog', 'integrations', 'entitlement', 'manualSteps'] as const) c.ome[key] = c.ome[key] ? 'Withheld for sharing' : ''
  }
  for (const c of collections) for (const row of result.design[c.key]) { row.id = ids.get(row.id)!; row.values = scrub(row.values, c.fields); row.values.name = row.id }
  for (const key of ['osVersion', 'toolVersion', 'controllerEndpoint', 'underlay', 'vipPool', 'tenantNetworks', 'bgpPeers', 'certificates', 'securityPolicy', 'recovery'] as const) result.sdn[key] = result.sdn[key] ? 'Withheld for sharing' : ''
  return result
}
