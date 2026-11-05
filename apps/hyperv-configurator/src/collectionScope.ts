import type { Collection } from './catalog'
import type { Project } from './project'
import { componentUsed, backupDeclined, monitoringDeclined, switchlessStorageSystems } from './componentDecisions'

const SAN_KINDS = new Set(['fc', 'iscsi'])
const sanInUse = (project: Project) => project.design.storageSystems.some(system => SAN_KINDS.has(String(system.values.kind)))

/**
 * Whether a repeatable collection is relevant to the current design. Hidden collections keep their saved records.
 * Component gates (SDN, firewall, ToR, OOB switch, console server, backup, monitoring) hide their collections even when
 * records exist, so a "not used" answer removes the component from the questionnaire and exports without deleting answers.
 * SAN route and interface inventories stay visible while they hold records, so no host-side answer is lost.
 */
export function collectionApplies(collection: Collection, project: Project): boolean {
  if (collection.section === 'sdn') return project.sdn.scope !== 'none'
  switch (collection.key) {
    case 'sanPaths': return project.design.sanPaths.length > 0 || sanInUse(project)
    case 'storageInterfaces': return project.design.storageInterfaces.length > 0 || sanInUse(project)
    case 'firewallDevices': case 'firewallInterfaces': case 'firewallGateways': return componentUsed(project, 'firewall')
    case 'torSwitches': return componentUsed(project, 'tor')
    case 'oobDevices': return componentUsed(project, 'oob')
    case 'consoleServers': case 'consolePorts': return componentUsed(project, 'consoleServer')
    // The cable map applies only to switchless S2D. Links stay saved when a system becomes switched.
    case 'storageLinks': return switchlessStorageSystems(project).length > 0
    case 'recoveryTests': return !backupDeclined(project)
    case 'capacityAlerts': return !monitoringDeclined(project)
  }
  return true
}
