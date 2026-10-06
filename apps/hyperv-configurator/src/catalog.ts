import {licensePlanningFields,licenseAssignmentsCollection} from './licensingFields'
import {licensingRightsFields} from './licensingRights'
import {licenseCoverageCollections} from './licenseCoverageFields'
import {licenseDependencyCollections} from './licenseDependencyFields'
import {omePlanningFields} from './omeFields'
import {managementProductFields,managementSystemFields} from './managementProductFields'
import {hostingContractFields,managementNetworksCollection,additionalProductFields} from './hostingContractFields'
import {availabilityFields,availabilityMemberFields} from './availabilityFields'
import {availabilityDetailFields,availabilityPlacementFields,availabilityDatabasesCollection} from './availabilityDetailFields'
import {identityReadinessFields,mediaReadinessFields,identityBindingsCollection,mediaBindingsCollection,arcReadinessFields} from './readinessFields'
import {hostDeploymentFields,clusterDeploymentFields,provisioningReadinessFields} from './hostDeploymentFields'
import {storageV20Fields,storageInterfacesCollection} from './storageReadinessFields'
import {networkV21Fields,networkCollections} from './networkDesignFields'
import {operationsFields,operationsCollections} from './operationsFields'
import {networkControlFields,networkTrafficClassesCollection} from './networkControlFields'
import {sdnRecordFields,sdnCollections} from './sdnFields'
import {sdnServiceCollections} from './sdnServiceFields'
import {networkDeviceCollections,networkDecisionV31Fields,storageLinksCollection} from './componentDecisionFields'
import {applyCollectionHints} from './fieldHints'
export type Answer = string | number | boolean
export type Answers = Record<string, Answer>
export interface DesignRecord { id: string; values: Answers }
export interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'notes' | 'reference'
  required?: boolean
  options?: Record<string, string>
  collection?: string
  hint?: string
  when?: { key: string; values: Answer[] }
  whenAny?: { key: string; values: Answer[] }[]
  min?: number
  max?: number
}
export interface Collection {
  key: string
  title: string
  singular: string
  section: string
  description: string
  fields: Field[]
}

const text = (key: string, label: string, required = false, hint?: string): Field => ({ key, label, type: 'text', required, hint })
const notes = (key: string, label: string, required = false): Field => ({ key, label, type: 'notes', required })
const num = (key: string, label: string, min = 0, max = 1e9): Field => ({ key, label, type: 'number', min, max })
const bool = (key: string, label: string): Field => ({ key, label, type: 'boolean' })
const select = (key: string, label: string, options: Record<string, string>, required = false): Field => ({ key, label, type: 'select', options, required })
const ref = (key: string, label: string, collection: string, required = false): Field => ({ key, label, type: 'reference', collection, required })
const when = (field: Field, key: string, ...values: Answer[]): Field => ({ ...field, when: { key, values } })
const clusterExecution = (field: Field): Field => ({ ...field, whenAny: [{ key: 'intent', values: ['package','execute'] }, { key: 'quorumAction', values: ['configure'] }] })
const identity = [text('name', 'Name', true), text('owner', 'Owner', true)]
const lifecycle = select('lifecycle', 'Lifecycle', { preserve: 'Preserve existing', adopt: 'Adopt / document', configure: 'Configure existing', create: 'Create new', expand: 'Expand', replace: 'Replace / reimage' }, true)
const os = select('os', 'Operating system', { ws2025: 'Windows Server 2025', ws2022: 'Windows Server 2022', legacy: 'Legacy / other (review required)' }, true)
const authority = select('authority', 'Configuration owner', { native: 'Native PowerShell / operator', vmm: 'VMM', atc: 'Network ATC', ansible: 'Ansible', existing: 'Existing fabric owner' }, true)
const resiliencies = { external: 'Array / service managed', mirror2: 'Two-way mirror', mirror3: 'Three-way mirror', parity: 'Dual parity', map: 'Mirror-accelerated parity', nestedMirror: 'Nested two-way mirror', nestedMap: 'Nested mirror-accelerated parity' }

export const profileCreationFields: Field[] = [
  text('virtualHardDiskId', 'VMM library VHD / VHDX ID (GUID)', true),
  select('vhdConversion', 'Dynamic image conversion', { fixed: 'Convert to fixed on deployment', retain: 'Retain the library image allocation type' }, true),
  select('joinMode', 'Profile membership', { domain: 'Join an AD domain', workgroup: 'Workgroup (support review)' }, true),
  text('profileDomain', 'Profile AD domain FQDN'), text('profileDomainOu', 'Profile computer OU / prestaging review'), text('domainJoinRunAsId', 'Domain join Run As account ID (GUID)'),
  text('localAdminCredentialRef', 'Local administrator runtime credential reference', true), text('computerAccessRunAsId', 'Computer access Run As account ID (GUID)'),
  notes('networkAdapterProfileIds', 'Physical NIC profile IDs (one GUID per line)', true),
  notes('networkAdapterReview', 'NIC profile mapping review', true),
  select('partitionStyle', 'OS disk partition style', { gpt: 'GPT / UEFI', mbr: 'MBR / BIOS' }, true),
  notes('diskConfiguration', 'Reviewed VMM disk configuration string', true), notes('diskConfigurationEvidence', 'Disk layout qualification evidence', true),
  notes('vmPaths', 'Profile VM placement paths (one absolute path per line)', true),
  select('driverSelection', 'Profile driver selection', { pnp: 'Match by Plug and Play IDs', tags: 'Match by reviewed driver tags' }, true),
  ref('driverArtifact', 'Qualified profile driver artifact', 'media'), notes('driverMatchingTags', 'Driver matching tags (one per line)'),
  text('answerFileId', 'VMM library answer-file ID (GUID)'), text('answerFileSha256', 'Answer-file SHA-256'),
  text('timeZoneId', 'VMM numeric time zone ID', true, 'Use the ID verified for the selected VMM build; locale text is retained separately.'),
  notes('profileAcceptance', 'Created profile review and returned-ID evidence', true),
].map(f => ({ ...when(f, 'profileState', 'create'), whenAny: [{key:'method',values:['vmm']}] }))

export const sections = [
  { key: 'project', title: 'Project', description: 'Define the scope and ownership of this design.' },
  { key: 'management', title: 'Management requirements', description: 'Choose capabilities and the components that provide them.' },
  { key: 'hosting', title: 'Hosting and availability', description: 'Place each component and record independent availability and recovery decisions.' },
  { key: 'topology', title: 'Sites and clusters', description: 'Define the estate you will build, expand or adopt.' },
  { key: 'hardware', title: 'Hosts and provisioning', description: 'Collect physical identities and complete provisioning profiles.' },
  { key: 'storage', title: 'Storage', description: 'Define storage systems, disks, volumes and ownership.' },
  { key: 'network', title: 'Networking and IP plan', description: 'Map adapters, traffic, addresses and network ownership.' },
  { key: 'sdn', title: 'SDN design and setup', description: 'Choose SDN architecture, services, placement and setup ownership.' },
  { key: 'identity', title: 'Identity, security and media', description: 'Record prerequisites, identities, certificate ownership and installation media.' },
  { key: 'products', title: 'Product configuration', description: 'Complete the selected products’ configuration and integration details.' },
  { key: 'licensing', title: 'Licensing and costs', description: 'Record entitlements, applicable rights, quote assumptions and purchase gaps.' },
  { key: 'operations', title: 'Operations and recovery', description: 'Assign maintenance, monitoring, backup and recovery responsibilities.' },
  { key: 'automation', title: 'Implementation handoff', description: 'Document implementation responsibilities, prerequisites and acceptance criteria.' },
  { key: 'review', title: 'Review and exports', description: 'Review completeness and download the design and implementation handoff.' },
] as const

export const collections: Collection[] = [
  { key: 'availabilityGroups', title: 'Availability groups', singular: 'availability group', section: 'hosting', description: 'Separate application and database availability from VM restart protection. Each server remains a component with its own capacity and failure domain.', fields: [
    ...availabilityFields, ...availabilityDetailFields, ...identity, select('product', 'Protected service', { vmm: 'VMM', scom: 'SCOM', sql: 'SQL Server', wac: 'Windows Admin Center', library: 'Library / file service', other: 'Other service' }, true),
    select('strategy', 'Availability strategy', { servicecluster: 'Clustered management service', resourcepool: 'SCOM resource pool', sqlfci: 'SQL failover cluster instance', sqlag: 'SQL availability group', filecluster:'Clustered VMM library file server', providerrestart: 'Infrastructure restart protection only', external: 'Externally supplied availability', custom: 'Other / support review required' }, true),
    text('endpoint', 'Service / listener endpoint', true), when(num('minimumActive', 'Minimum members required after a failure', 1), 'strategy', 'servicecluster', 'resourcepool', 'sqlfci', 'sqlag', 'filecluster', 'custom'), when(num('failureDomainsLost', 'Simultaneous failure domains to tolerate', 1), 'strategy', 'servicecluster', 'resourcepool', 'sqlfci', 'sqlag', 'filecluster', 'custom'),
    text('quorum', 'Quorum / witness / observer design'), notes('antiAffinity', 'Enforced placement and anti-affinity policy'), notes('databaseRecovery', 'Database dependency and recovery order'),
    num('rtoMinutes', 'Service RTO (minutes)'), num('rpoMinutes', 'Data RPO (minutes)'), notes('recovery', 'Failover, failback and restore acceptance', true),
    notes('supportEvidence', 'Exact version / topology support review'), text('reviewedAt', 'Support review date (YYYY-MM-DD)'), notes('externalEvidence', 'External owner / SLA / availability evidence'),
  ] },
  { key: 'availabilityMembers', title: 'Availability group members', singular: 'availability member', section: 'hosting', description: 'Link existing component records to each service. Membership does not add another VM or duplicate resource demand.', fields: [
    ...identity, ref('group', 'Availability group', 'availabilityGroups', true), ref('component', 'Component', '$components', true), select('role', 'Member role', { active: 'Active', passive: 'Passive / failover', replica: 'Replica', observer: 'SCOM voting observer (no pool workload)' }, true), ...availabilityMemberFields, ...availabilityPlacementFields,
  ] },
  { key: 'dependencies', title: 'Service and bootstrap dependencies', singular: 'dependency', section: 'hosting', description: 'Link each dependent resource to a prerequisite. Model existing and external services explicitly; adding a dependency never creates a replacement service.', fields: [
    ...identity, ref('dependent', 'Dependent resource', '$resources', true), ref('prerequisite', 'Required resource', '$resources', true),
    select('kind', 'Dependency purpose', { sql: 'VMM database', operationalDb: 'SCOM operational database', warehouseDb: 'SCOM warehouse database', directory: 'Directory / DNS', library: 'VMM library', placement: 'Hosting platform', provisioning: 'Provisioning service', certificate: 'Certificate service', generic: 'Other prerequisite' }, true),
    select('phase', 'Dependency phase', { bootstrap: 'Initial deployment', runtime: 'Normal operation', recovery: 'Recovery / cold start' }, true), notes('acceptance', 'Readiness and recovery acceptance', true),
  ] },
  { key: 'imports', title: 'Source evidence', singular: 'source', section: 'project', description: 'Retain where imported requirements came from. User-entered design details do not overwrite the source plan.', fields: [
    ...identity, select('kind', 'Source', { surveyor: 'Hyper-V Surveyor', inventory: 'Read-only inventory', manual: 'Manual requirements' }, true), text('observedAt', 'Observed / imported time (UTC)'), text('sourceVersion', 'Source schema / version'), text('sha256', 'Source SHA-256'), notes('summary', 'Original sizing and management assumptions'), notes('overrides', 'Reviewed changes to imported assumptions'),
  ] },
  { key: 'workloads', title: 'Workload requirements', singular: 'workload', section: 'project', description: 'Optional workload requirements imported from Surveyor or entered manually. Deployment identities and host mappings remain separate.', fields: [
    ...identity, ref('source', 'Source evidence', 'imports'), text('sourceId', 'Original workload ID'), num('vCpu', 'vCPU'), num('memoryGiB', 'Memory (GiB)'), num('storageGiB', 'Consumed storage (GiB)'), num('provisionedGiB', 'Provisioned storage (GiB)'), text('sourceHost', 'Original host'), text('sourceCluster', 'Original cluster'), text('target', 'Intended placement'), notes('overrides', 'User overrides / requirements'),
  ] },
  { key: 'sites', title: 'Sites and failure domains', singular: 'site', section: 'topology', description: 'Name the site and physical failure boundaries used by hosts and management resources.', fields: [
    ...identity, text('code', 'Site code'), text('datacenter', 'Datacenter'), text('racks', 'Racks / fault domains'), notes('connectivity', 'Inter-site connectivity and failure assumptions'), notes('naming', 'Naming convention'),
  ] },
  { key: 'clusters', title: 'Clusters and standalone hosts', singular: 'cluster', section: 'topology', description: 'Separate desired configuration, current state and deployment intent.', fields: [
    ...identity, lifecycle, ref('site', 'Site', 'sites', true), select('topology', 'Topology', { standalone: 'Standalone host', cluster: 'Single-site cluster', multisite: 'Multi-site (support review required)' }, true), os,
    select('edition', 'Edition', { standard: 'Standard', datacenter: 'Datacenter' }, true), text('build', 'Exact OS build'),
    select('startingState', 'Starting state', { baremetal: 'Bare metal', installed: 'OS installed', ready: 'Hyper-V ready', existing: 'Existing cluster', mixed:'Mixed / per-host states' }, true),
    select('intent', 'Deployment intent', { design: 'Collect design only', handoff: 'Operator handoff', vmm: 'VMM bare-metal handoff', package: 'Configuration package', execute: 'External implementation handoff' }, true), authority,
    text('fqdn', 'Cluster FQDN'), text('address', 'Cluster IP address'), text('domain', 'Domain / OU'),
    clusterExecution(text('clusterModuleVersion', 'FailoverClusters module version', false, 'Optional version reference for the implementation team.')),
    clusterExecution(ref('seedHost', 'Initial cluster host', 'hosts')),
    clusterExecution(text('domainFqdn', 'Cluster AD domain FQDN')),
    when(ref('managementNetwork', 'Cluster management network', 'networks'), 'intent', 'package', 'execute'),
    select('witness', 'Witness', { none: 'None / not applicable', file: 'File-share witness', cloud: 'Cloud witness', disk: 'Disk witness' }), when(text('witnessRef', 'Witness reference'), 'witness', 'file', 'cloud', 'disk'),
    select('quorumAction', 'Quorum action', { preserve: 'Preserve / document only', configure: 'Prepare quorum configuration' }),
    when(text('witnessSharePath', 'Witness UNC share path'), 'witness', 'file'),
    when(select('witnessShareIdentity', 'Witness share identity', { domain: 'Windows server in the same AD forest', local: 'Non-domain account / separate qualification' }), 'witness', 'file'),
    when(text('witnessAuthRef', 'Witness runtime secret reference', false, 'Cloud key or non-domain share only; a domain share uses the cluster identity.'), 'witness', 'cloud', 'file'),
    when(text('witnessAccountName', 'Cloud witness storage account name'), 'witness', 'cloud'),
    when(text('witnessEndpoint', 'Cloud witness service endpoint', false, 'DNS service suffix, for example core.windows.net; no URL or account key.'), 'witness', 'cloud'),
    when(text('witnessDiskResourceId', 'Witness disk cluster resource ID (GUID)'), 'witness', 'disk'),
    when(ref('witnessDiskVolume', 'Witness disk volume record', 'volumes'), 'witness', 'disk'),
    when(notes('witnessPlacement', 'Witness failure-domain placement'), 'witness', 'file', 'cloud', 'disk'),
    when(notes('witnessPrerequisites', 'Witness prerequisite and access review'), 'witness', 'file', 'cloud', 'disk'),
    notes('witnessAcceptance', 'Quorum validation and failover acceptance'),
    num('reserveNodes', 'Maintenance / failure reserve nodes'), text('vmPath', 'Default VM configuration path'), text('vhdPath', 'Default VHD path'),
    notes('migration', 'Live migration policy'), notes('bootstrap', 'Independent management bootstrap / recovery path'), notes('validation', 'Cluster validation evidence / acceptance'),
  ] },
  { key: 'hosts', title: 'Physical host inventory', singular: 'host', section: 'hardware', description: 'One record per physical machine. Existing resources retain their identity and lifecycle.', fields: [
    ref('managementAdapter', 'VMM deployment management adapter', 'adapters'), text('bmcRunAsId', 'VMM BMC Run As account ID (GUID)'),
    ...identity, lifecycle, ref('cluster', 'Cluster', 'clusters', true), text('fqdn', 'Host FQDN', true), text('vendor', 'Vendor'), text('model', 'Model'), text('serial', 'Serial / service tag', true), text('uuid', 'SMBIOS UUID'), text('rack', 'Rack / failure domain'),
    num('sockets', 'CPU sockets'), num('coresPerSocket', 'Physical cores per socket'), num('memoryGiB', 'Memory (GiB)'), text('managementIp', 'Management IP address', true),
    text('bmcAddress', 'BMC / iDRAC address'), select('bmcProtocol', 'BMC protocol', { redfish: 'Redfish', ipmi: 'IPMI', wsman: 'WS-Man', other: 'Other / verify support' }), num('bmcPort', 'BMC port', 0, 65535), text('bmcFirmware', 'BMC firmware'), text('bmcCredentialRef', 'BMC secret / Run As reference'), text('bmcCertificate', 'BMC certificate policy'),
    select('boot', 'Firmware boot mode', { uefi: 'UEFI', bios: 'BIOS' }), bool('secureBoot', 'Secure Boot'), text('pxeMac', 'PXE NIC MAC address'), text('bootOrder', 'Boot order'), text('dhcpReservation', 'DHCP reservation / PXE network'),
    ref('profile', 'Physical provisioning profile', 'profiles'), text('bootDisk', 'OS disk / RAID target'), notes('partitionLayout', 'OS partition layout'), text('firmwareBaseline', 'Firmware baseline and owner'),
    text('domainJoinRef', 'Domain join secret / Run As reference'), notes('existingWorkloads', 'Existing workload inventory and preservation plan'), notes('reimageScope', 'Explicit replacement scope and approval reference'), text('changeWindow', 'Change window'), notes('acceptance', 'Host registration / driver / DNS / storage acceptance'),
  ] },
  { key: 'profiles', title: 'VMM and host provisioning profiles', singular: 'profile', section: 'hardware', description: 'Collect an existing profile reference or a complete desired profile. Export desired settings for your existing implementation process.', fields: [
    text('vmmModuleVersion', 'Exact VirtualMachineManager module version'), text('hostGroupId', 'VMM host group ID (GUID)'), text('logicalNetworkId', 'VMM management logical network ID (GUID)'),
    ...identity, select('method', 'Provisioning method', { vmm: 'VMM BMC / PXE', redfish: 'OEM virtual media', prepared: 'Prepared hosts', manual: 'Operator deployment' }, true),
    select('profileState', 'Profile state', { existing: 'Use existing profile', create: 'Define a new profile' }, true), text('profileRef', 'Existing profile reference'), text('vmmEndpoint', 'VMM service endpoint'), text('vmmVersion', 'VMM version / update rollup'), text('hostGroup', 'VMM host group'), text('cloud', 'VMM cloud'), text('delegation', 'Delegated authority'),
    text('wdsServer', 'PXE / WDS server'), text('wdsRegistration', 'VMM PXE registration'), text('adkVersion', 'ADK version'), text('winpeVersion', 'WinPE version'), text('bootDrivers', 'Boot-image drivers'),
    ref('image', 'Generalized OS image', 'media'), os, select('installType', 'Installation type', { core: 'Server Core', desktop: 'Desktop Experience' }), text('hardwareApplicability', 'Applicable models / firmware'),
    text('libraryPath', 'VHD / VHDX library path'), text('driverPackage', 'Driver package / hash'), text('locale', 'Locale / time zone'), text('activation', 'Activation method (no product keys)'), text('answerFile', 'Answer-file reference'),
    text('logicalSwitch', 'VMM logical switch / uplink profile'), text('managementNic', 'Management NIC classification'), notes('vnics', 'Host virtual NICs / classifications'), notes('networkSites', 'VMM network sites and IP pool references'),
    text('runAsRef', 'VMM Run As reference'), notes('storagePrerequisites', 'SAN presentation / MPIO / S2D eligibility'), notes('preflight', 'Reachability and machine allowlist checks'), notes('completion', 'VMM job tracking and post-provisioning acceptance'),
    ...profileCreationFields,
  ] },
  { key: 'storageSystems', title: 'Storage systems', singular: 'storage system', section: 'storage', description: 'Model each storage backend separately, including external storage ownership.', fields: [
    ...identity, ref('cluster', 'Cluster', 'clusters', true), select('kind', 'Storage model', { s2d: 'Storage Spaces Direct', fc: 'Fibre Channel SAN', iscsi: 'iSCSI SAN', smb: 'SMB file service', local: 'Local storage' }, true), when(ref('localHost', 'Local storage host', 'hosts', true), 'kind', 'local'),
    text('vendor', 'Vendor / array / model'), text('version', 'Firmware / software version'), text('endpoint', 'Array / target / share endpoint'),
    when(notes('fabrics', 'Dual fabric / zoning / WWPN mapping'), 'kind', 'fc'), when(notes('portals', 'Target portals / initiator IQNs / path diversity'), 'kind', 'iscsi'),
    when(text('mpio', 'MPIO policy / provider'), 'kind', 'fc', 'iscsi'), when(text('authRef', 'Authentication secret reference'), 'kind', 'iscsi', 'smb'),
    when(notes('diskEligibility', 'Disk symmetry / controller / media eligibility'), 'kind', 's2d'), when(notes('permissions', 'Share permissions / availability / RDMA'), 'kind', 'smb'),
    num('rawTiB', 'Raw capacity (TiB)'), num('usableTiB', 'Planned usable capacity (TiB)'), num('reserveTiB', 'Logical capacity held in reserve (TiB)'), notes('recovery', 'Storage recovery and support qualification'),
  ] },
  { key: 'disks', title: 'Physical drive layout', singular: 'drive group', section: 'storage', description: 'Separate boot, cache and capacity drives for each host.', fields: [
    ...identity, ref('host', 'Host', 'hosts', true), select('role', 'Drive role', { boot: 'Boot', cache: 'Cache', capacity: 'Capacity' }, true), select('media', 'Media', { nvme: 'NVMe', ssd: 'SSD', hdd: 'HDD' }), num('count', 'Drive count'), num('sizeGiB', 'Size per drive (GiB)'), text('controller', 'Controller / RAID / HBA mode'), text('model', 'Drive model / endurance'), text('firmware', 'Firmware'),
  ] },
  { key: 'volumes', title: 'Volumes, CSVs and LUNs', singular: 'volume', section: 'storage', description: 'Record logical allocation and actual backing storage separately.', fields: [
    lifecycle, text('sourceIdentity', 'Existing volume identity'), num('currentSizeGiB', 'Current logical size (GiB)'), select('currentResiliency', 'Current resiliency', resiliencies), text('currentPath', 'Current volume path'), select('currentProvisioning', 'Current volume provisioning', {fixed:'Fixed',thin:'Thin'}), notes('replacementApproval', 'Replacement approval and data migration plan'),
    ...identity, ref('system', 'Storage system', 'storageSystems', true), text('path', 'CSV / mount / share path'), text('lunId', 'LUN / volume ID'), num('sizeGiB', 'Logical size (GiB)'), num('usedGiB', 'Expected consumed size (GiB)'),
    select('provisioning', 'Provisioning', { thin: 'Thin', fixed: 'Fixed' }, true), select('filesystem', 'Filesystem', { refs: 'ReFS', ntfs: 'NTFS', external: 'External file service' }),
    select('resiliency', 'Resiliency', resiliencies),
    when(select('parityLayout', 'Parity encoding layout', { rs2: 'RS 2 data + 2 parity', rs4: 'RS 4 data + 2 parity', rs6: 'RS 6 data + 2 parity', lrc8: 'LRC 8 data + 2 local + 1 global', lrc12: 'LRC 12 data + 2 local + 1 global' }), 'resiliency', 'parity', 'map'),
    when(select('parityMedia', 'Parity capacity media', { hdd: 'HDD', ssd: 'SSD', nvme: 'NVMe' }), 'resiliency', 'parity', 'map', 'nestedMap'),
    when(num('mirrorTierGiB', 'Mirror tier logical size (GiB)'), 'resiliency', 'map', 'nestedMap'), when(num('parityTierGiB', 'Parity tier logical size (GiB)'), 'resiliency', 'map', 'nestedMap'),
    when(num('parityColumns', 'Nested parity columns per server', 0, 7), 'resiliency', 'nestedMap'), notes('layoutEvidence', 'Exact storage tier layout and support evidence'),
    text('workloadPlacement', 'Workload / VM placement'), text('hostMapping', 'Host group / LUN mapping'), notes('policy', 'Reserve, growth and recovery policy'),
  ] },
  { key: 'storagePaths', title: 'Storage directories', singular: 'storage directory', section: 'storage', description: 'Directories belong to a volume. They do not add capacity or create another CSV.', fields: [
    ...identity, lifecycle, ref('volume', 'Backing volume', 'volumes', true), text('path', 'Full directory path', true), select('purpose', 'Directory purpose', { config: 'VM configuration', disks: 'Virtual disks', checkpoints: 'Checkpoints', library: 'Library / images', other: 'Other' }, true), notes('permissions', 'Access permissions and owner'),
  ] },
  { key: 'storageAllocations', title: 'Workload disk placement', singular: 'disk allocation', section: 'storage', description: 'Map each disk or disk group to its owner and directory. These quantities are checked against volume budgets, never added to them again.', fields: [
    ...identity, ref('resource', 'Workload / component / SDN resource', '$storageConsumers', true), ref('directory', 'Storage directory', 'storagePaths', true), text('diskKey', 'Unique disk / allocation key', true), num('sizeGiB', 'Allocated logical size (GiB)'), num('usedGiB', 'Expected disk consumption (GiB)'), select('provisioning', 'Virtual disk provisioning', { fixed: 'Fixed VHDX', dynamic: 'Dynamic VHDX', external: 'Externally managed' }, true),
  ] },
  { key: 'sanPaths', title: 'SAN I/O paths', singular: 'SAN I/O path', section: 'storage', description: 'One host-to-LUN route per initiator, target and fabric. I/O path count is independent of volume and directory counts.', fields: [
    ...identity, ref('volume', 'Presented volume', 'volumes', true), ref('host', 'Initiating host', 'hosts', true), text('initiator', 'Initiator WWPN / IQN', true), text('target', 'Target WWPN / portal', true), text('fabric', 'Independent fabric / network', true), select('state', 'Observed path state', { planned: 'Planned', active: 'Active', standby: 'Standby', failed: 'Failed' }, true), text('observedAt', 'Observation time (UTC)'), text('evidence', 'Multipath observation evidence'),
  ] },
  { key: 'networks', title: 'Networks and address pools', singular: 'network', section: 'network', description: 'Address uniqueness is evaluated within the routing scope. Isolated tenant spaces may overlap.', fields: [
    ...identity, ref('site', 'Site', 'sites'), select('purpose', 'Purpose', { management: 'Management', bmc: 'OOB / BMC', storage: 'Storage', migration: 'Live migration', cluster: 'Cluster', provider: 'SDN provider / HNV', vip: 'VIP', tenant: 'Tenant', vm: 'VM network' }, true),
    text('routingScope', 'Routing scope / tenant ID', true), text('cidr', 'IPv4 CIDR', true), num('vlan', 'VLAN ID (0 = untagged)', 0, 4094), text('gateway', 'Default gateway'), text('dns', 'DNS servers'), text('ntp', 'NTP servers'),
    text('poolStart', 'Pool start address'), text('poolEnd', 'Pool end address'), text('dhcp', 'DHCP / reservations'), num('mtu', 'MTU'), bool('routed', 'Routed network'), authority, notes('firewall', 'Required firewall flows'), notes('physicalPrerequisites', 'Switch / routing prerequisites and owner'),
  ] },
  { key: 'adapters', title: 'Physical adapters and host switches', singular: 'adapter', section: 'network', description: 'Assign a single owner per host switch; collect physical NIC and switch-port identities.', fields: [
    ...identity, ref('host', 'Host', 'hosts', true), text('mac', 'MAC address', true), text('slot', 'NIC slot / port'), text('model', 'NIC model / driver / firmware'), num('speedGbps', 'Link speed (Gbps)'), text('switchPort', 'Physical switch / port'), text('switchName', 'Host virtual switch'), authority,
    select('teaming', 'Teaming', { none: 'None', set: 'Switch Embedded Teaming' }), text('teamMembers', 'Team member NIC IDs'), ref('network', 'Primary network', 'networks'), text('allowedVlans', 'Allowed VLANs'),
    select('rdma', 'RDMA', { none: 'Disabled', roce: 'RoCE', iwarp: 'iWARP' }), num('mtu', 'MTU'), notes('qos', 'QoS / DCB / PFC / ETS'), notes('vnics', 'Host vNICs / traffic roles / IP assignments'),
  ] },
  { key: 'sdnResources', title: 'SDN infrastructure resources', singular: 'SDN resource', section: 'sdn', description: 'One record per controller, MUX or gateway. A host-resident controller consumes host capacity without adding a controller VM.', fields: [
    ...identity, lifecycle, select('role', 'Role', { controller: 'Controller VM', hostcontroller: 'Host-resident controller', mux: 'SLB / MUX VM', gateway: 'RAS gateway VM' }, true), ref('cluster', 'Hosting cluster', 'clusters'), text('placement', 'Host / provider placement'), text('failureDomain', 'Failure domain'),
    num('vCpu', 'vCPU / host CPU allowance'), num('memoryGiB', 'Memory (GiB)'), num('diskGiB', 'Disk (GiB)'), text('managementIp', 'Management IP'), ref('providerNetwork', 'Provider network', 'networks'), text('endpoint', 'Service endpoint'), text('certificateRef', 'Certificate reference'), text('credentialRef', 'Credential reference'), num('throughputGbps', 'Gateway throughput requirement (Gbps)'), notes('availability', 'Active / reserve / failover design'),
  ] },
  { key: 'bgpPeers', title: 'BGP peers', singular: 'BGP peer', section: 'sdn', description: 'Record routing ownership and expected route exchange.', fields: [
    ...identity, text('localIp', 'Local peer IP', true), num('localAsn', 'Local ASN', 1, 4294967295), text('remoteIp', 'Remote peer IP', true), num('remoteAsn', 'Remote ASN', 1, 4294967295), notes('routes', 'Advertised / accepted routes'), notes('policy', 'Route policy / timers / redundancy'), text('authRef', 'Authentication reference'),
  ] },
  { key: 'tenantServices', title: 'Tenant networks and services', singular: 'tenant service', section: 'sdn', description: 'Define isolation, security, load-balancing and gateway behavior per tenant.', fields: [
    ...identity, text('tenantId', 'Logical tenant identifier', true), ref('network', 'Tenant network', 'networks'), select('service', 'Service', { network: 'Virtual network', policy: 'Security policy', loadBalancer: 'Load balancing', nat: 'NAT', gateway: 'Site-to-site gateway' }, true),
    text('vip', 'VIP / public endpoint'), text('backendPool', 'Backend pool'), text('ports', 'Protocol / ports'), text('probe', 'Health probe'), text('tunnel', 'Tunnel type / endpoints'), text('authRef', 'Tunnel authentication reference'), notes('policy', 'Rules / priority / allowed traffic'), notes('validation', 'Isolation / connectivity / failover acceptance'),
  ] },
  { key: 'identities', title: 'Identity, domains and certificates', singular: 'identity service', section: 'identity', description: 'Use references for secrets. Record existing dependencies without creating replacements.', fields: [
    ...identity, lifecycle, select('kind', 'Kind', { domain: 'Domain / DNS', service: 'Service account', gmsa: 'gMSA', pki: 'PKI / certificate', runner: 'Runner identity' }, true), text('domain', 'Forest / domain FQDN'), text('netbios', 'NetBIOS name'), text('ou', 'OU / pre-staged objects'), notes('trust', 'Trust / DNS / delegation prerequisites'),
    text('account', 'Account / gMSA name'), text('credentialRef', 'Credential reference'), text('dkm', 'DKM container'), text('spns', 'SPNs / delegation'), text('certificate', 'Certificate subject / SAN / template'), text('issuer', 'CA / issuing authority'), text('crl', 'CRL / OCSP endpoint'), text('renewal', 'Renewal owner / expiry'), notes('security', 'RBAC / WinRM / SSH / hardening / privileged access'), notes('recovery', 'Recovery / revocation procedure'),
  ] },
  { key: 'media', title: 'Installation media and artifacts', singular: 'artifact', section: 'identity', description: 'Pin image and product builds and verify hashes before deployment.', fields: [
    ...identity, select('kind', 'Artifact type', { vhdx: 'Generalized VHDX', vhd: 'Generalized VHD', iso: 'ISO', appliance: 'Appliance image', driver: 'Driver package', update: 'Product update', script: 'Script / module' }, true), text('version', 'Exact build / version', true), text('source', 'Source / artifact URI', true), text('sha256', 'SHA-256', true), text('signature', 'Signature / publisher'), text('edition', 'Edition / image index'), text('cache', 'Offline cache path'), text('applicability', 'Hardware / product applicability'), notes('servicing', 'Servicing baseline / download procedure'),
  ] },
  { key: 'licenses', title: 'Entitlements and purchase worksheet', singular: 'license item', section: 'licensing', description: 'Enter the applicable agreement and quote. Quantities are planning assumptions until reviewed by the licensing owner.', fields: [
    ...identity, select('product', 'Product', { windows: 'Windows Server', systemcenter: 'System Center', sql: 'SQL Server', access: 'CAL / RDS / SAL', azure: 'Azure service', ome: 'OME / plugin', vmware: 'VMware', backup: 'Backup', other: 'Other' }, true),
    text('edition', 'Edition / version'), select('context', 'Commercial context', { internal: 'Internal IT', customer: 'Customer-owned', hosted: 'Hosted / MSP' }), text('program', 'Agreement / program'), text('basis', 'Licensing basis / SKU'),
    select('rights', 'Coverage source', { existing: 'Existing entitlement', included: 'Included restricted-use right', purchase: 'New purchase', review: 'Needs review' }, true), when(num('required', 'Manual required units'), 'calculationModel', 'manual'), num('owned', 'Available covered units'), num('unitPrice', 'Price per unit'), text('currency', 'Currency'), text('quoteDate', 'Quote date'), select('term', 'Charge type', { perpetual: 'Perpetual', monthly: 'Monthly', annual: 'Annual' }),
    text('coverage', 'Covered hosts / OSEs / managed estate'), text('saExpiry', 'Subscription / SA expiry (YYYY-MM-DD)'), notes('failover', 'Maintenance / failover placement assumptions'), notes('restrictedUse', 'Included SQL / restricted-use eligibility'), notes('evidence', 'Entitlement evidence / assumptions / exclusions'),
    ...licensePlanningFields,
    ...licensingRightsFields,
  ] },
  licenseAssignmentsCollection,
  ...licenseCoverageCollections,
  ...licenseDependencyCollections,
  { key: 'operations', title: 'Operations and recovery plans', singular: 'operations plan', section: 'operations', description: 'Assign service ownership and measurable recovery acceptance.', fields: [
    ...identity, text('scope', 'Service / cluster scope', true), text('monitoring', 'Monitoring / alert routing'), text('managementPacks', 'SCOM management packs / versions'), num('retentionDays', 'Monitoring retention (days)'), text('patchRing', 'Patch ring / CAU owner'), text('changeWindow', 'Maintenance window'),
    text('backup', 'Backup product / scope / schedule'), num('rtoMinutes', 'RTO (minutes)'), num('rpoMinutes', 'RPO (minutes)'), notes('restore', 'Restore sequence and acceptance test'), text('capacityThresholds', 'Capacity alert thresholds'), notes('dr', 'Site DR / dependency recovery'), text('evidence', 'Last successful recovery test reference'),
  ] },
  { key: 'stages', title: 'Implementation stages and evidence', singular: 'stage', section: 'automation', description: 'Downloads are handoff files. Runtime status requires returned evidence from the responsible executor.', fields: [
    ...identity, num('order', 'Stage order'), select('kind', 'Stage', { prerequisite: 'Prerequisites', host: 'Host provisioning', cluster: 'Cluster creation', management: 'Management installation', ome: 'OME manual deployment', sdn: 'SDN setup', validate: 'Validation' }, true),
    select('executor', 'Executor', { operator: 'Operator', vmm: 'VMM', powershell: 'PowerShell', ansible: 'Ansible', terraform: 'Terraform', dsc: 'DSC' }, true), text('consumer', 'Named script / module / playbook'), text('version', 'Pinned consumer version'), text('targets', 'Explicit target resource IDs'), text('dependsOn', 'Preceding stage IDs'), text('runner', 'Runner reference'), text('credentialRef', 'Runtime credential reference'),
    notes('inputs', 'Input files / prerequisites'), notes('acceptance', 'Acceptance commands / expected results', true), notes('rollback', 'Failure / rollback / resume procedure'), select('status', 'Observed state', { planned: 'Planned', running: 'Running', failed: 'Failed', passed: 'Passed', manual: 'Manual task outstanding' }), text('evidence', 'Runtime evidence reference'), text('observedAt', 'Observation time (UTC)'),
  ] },
]

export const hostingFields: Field[] = [
  ...hostingContractFields,
  text('providerVersion', 'Hypervisor / provider version'), text('providerEndpoint', 'vCenter / fabric / provider endpoint'), text('datacenter', 'Datacenter / Cloud Director organization'), text('resourcePool', 'Cluster / resource pool / Org VDC'), text('vapp', 'vApp / folder'), text('datastore', 'Datastore / storage policy'), text('template', 'Image / catalog / template'), text('network', 'Network / port group'),
  text('fqdn', 'Guest / appliance FQDN'), text('ip', 'IP / prefix'), text('gateway', 'Gateway'), text('dns', 'DNS servers'), text('ntp', 'NTP servers'), text('vlan', 'VLAN'), text('os', 'Guest OS / install type'), text('domain', 'Domain / OU'),
  bool('createInfrastructure', 'Create infrastructure'), bool('configureGuest', 'Configure guest'), bool('installProduct', 'Install product'), bool('integrateProduct', 'Configure product integrations'),
  notes('antiAffinity', 'Placement / anti-affinity rules'), notes('databaseHa', 'Database HA dependency'), notes('siteDr', 'Site disaster recovery'), notes('bootstrap', 'Independent bootstrap / recovery path'), notes('supportEvidence', 'Version / topology support evidence'),
]

export const productFields: Record<string, Field[]> = {
  ...additionalProductFields,
  vmm: [text('serviceName', 'Management service name'), text('dkm', 'DKM container'), text('serviceAccount', 'Service account reference'), text('sql', 'SQL instance / listener / database'), text('library', 'Library servers / shares'), num('libraryGiB', 'Library content (GiB)'), text('hostGroups', 'Host groups'), notes('clouds', 'Clouds / quotas / roles'), notes('templates', 'Images / VM templates'), notes('fabric', 'Logical networks / sites / IP pools / port and uplink profiles'), notes('integrations', 'Integrations and ownership')],
  scom: [text('managementGroup', 'Management group'), text('resourcePools', 'Management servers / resource pools'), text('operationalDb', 'Operational database'), text('warehouseDb', 'Data warehouse'), num('operationalRetention', 'Operational retention (days)'), num('warehouseRetention', 'Warehouse retention (days)'), num('agents', 'Managed agents'), text('managementPacks', 'Management pack versions'), text('actionAccount', 'Action account reference'), text('readerAccount', 'Reader account reference'), text('writerAccount', 'Writer account reference'), text('gateway', 'Gateways / cross-domain certificates'), notes('webReporting', 'Web / reporting roles and recovery'), notes('alerts', 'Alert routes / maintenance schedules')],
  sql: [select('edition', 'SQL edition', { standard: 'Standard', enterprise: 'Enterprise', developer: 'Developer (non-production)' }), text('instance', 'Instance / ports'), text('collation', 'Supported collation'), text('serviceAccount', 'Service identity / SPNs'), text('dataPath', 'Data path'), text('logPath', 'Log path'), text('tempdbPath', 'tempdb path'), text('backupPath', 'Backup path'), select('topology', 'SQL topology', { standalone: 'Standalone', fci: 'Failover cluster instance', ag: 'Availability group' }), text('listener', 'Listener / IPs'), notes('replicas', 'Replicas / synchronization / failover / endpoints'), text('witness', 'Witness'), notes('databases', 'Database-to-product mapping'), notes('backup', 'Backups / retention / restore acceptance')],
  wac: [select('mode', 'WAC mode', { administration: 'Administration Mode', virtualization: 'Virtualization Mode (version/support review)' }), text('url', 'Gateway URL / port'), text('certificate', 'Certificate source / renewal'), text('authentication', 'Authentication / delegation'), text('roles', 'Operator roles'), text('scope', 'Connection scope'), text('extensions', 'Extension versions')],
  ome: [text('image', 'Appliance image / source'), text('sha256', 'Image SHA-256'), text('certificate', 'HTTPS certificate / renewal'), text('proxy', 'Proxy requirements'), notes('rbac', 'Admin / RBAC / access policy'), notes('backup', 'Appliance backup / restore procedure'), notes('acceptance', 'First boot / discovery / integration acceptance evidence'),...omePlanningFields],
  identity: [text('forest', 'Forest'), text('domain', 'Domain / DNS'), notes('trust', 'Trust and delegation'), notes('recovery', 'Directory recovery')],
  pki: [text('authority', 'Root / issuing CA'), text('templates', 'Certificate templates'), text('crl', 'CRL / OCSP availability'), notes('recovery', 'CA recovery / renewal')],
  library: [text('shares', 'Library shares'), num('quotaGiB', 'Quota (GiB)'), text('images', 'Images / versions'), text('availability', 'Share availability / replication')],
  pxe: [text('registration', 'VMM registration'), text('adk', 'ADK build'), text('winpe', 'WinPE build'), text('drivers', 'Boot drivers'), text('dhcp', 'DHCP / relay prerequisites')],
  arc: [text('vmm', 'Existing VMM reference'), text('region', 'Azure region'), text('scopeRef', 'Logical Azure scope reference'), text('network', 'Network / proxy / DNS'), notes('outbound', 'Outbound prerequisites'), notes('rbac', 'Identity / RBAC'), notes('services', 'Selected paid services / onboarding scope')],
  runner: [text('engine', 'Execution engines / versions'), text('connectivity', 'Target connectivity'), text('identity', 'Runtime identity reference'), notes('authorization', 'Authorization and target boundary')],
}

export type DesignData = Record<string, DesignRecord[]>
collections.push(managementNetworksCollection)
collections.push(availabilityDatabasesCollection)
collections.find(c=>c.key==='identities')!.fields.push(...identityReadinessFields)
collections.find(c=>c.key==='media')!.fields.push(...mediaReadinessFields)
collections.push(identityBindingsCollection,mediaBindingsCollection)
collections.find(c=>c.key==='hosts')!.fields.push(...hostDeploymentFields)
collections.find(c=>c.key==='clusters')!.fields.push(...clusterDeploymentFields)
collections.find(c=>c.key==='profiles')!.fields.push(...provisioningReadinessFields)
for(const [key,fields]of storageV20Fields)collections.find(c=>c.key===key)!.fields.push(...fields)
collections.push(storageInterfacesCollection)
for(const [key,fields]of networkV21Fields)collections.find(c=>c.key===key)!.fields.push(...fields)
collections.push(...networkCollections)
collections.find(c=>c.key==='operations')!.fields.push(...operationsFields)
collections.push(...operationsCollections)
for(const [key,fields]of networkControlFields)collections.find(c=>c.key===key)!.fields.push(...fields)
for(const [key,fields]of sdnRecordFields)collections.find(c=>c.key===key)!.fields.push(...fields)
collections.push(...sdnCollections)
collections.push(...sdnServiceCollections)
collections.push(networkTrafficClassesCollection)
for(const [key,fields]of networkDecisionV31Fields)collections.find(c=>c.key===key)!.fields.push(...fields)
collections.push(...networkDeviceCollections)
collections.push(storageLinksCollection)
applyCollectionHints(collections)
productFields.arc.push(...arcReadinessFields)
for(const product of Object.keys(productFields))if(product!=='ome')productFields[product].push(...managementSystemFields,...(managementProductFields[product]||[]))
export function emptyDesign(): DesignData { return Object.fromEntries(collections.map(c => [c.key, []])) }
export function defaultAnswers(fields: Field[]): Answers {
  return Object.fromEntries(fields.map(f => [f.key, f.key === 'quorumAction' ? 'preserve' : f.key === 'calculationModel' ? 'manual' : f.key === 'quoteStatus' ? 'review' : f.type === 'boolean' ? false : f.type === 'number' ? 0 : '']))
}
export function newRecord(collection: Collection): DesignRecord { return { id: crypto.randomUUID(), values: defaultAnswers(collection.fields) } }
export function visibleField(field: Field, answers: Answers): boolean { return (!field.when || field.when.values.includes(answers[field.when.key])) && (!field.whenAny || field.whenAny.some(condition=>condition.values.includes(answers[condition.key]))) }
