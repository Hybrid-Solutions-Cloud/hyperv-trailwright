import {sdnArchitectureFields,sdnArchitectureKeys} from './sdnArchitectureFields'
import { collections, defaultAnswers, emptyDesign, hostingFields, productFields, profileCreationFields, type Answers, type DesignData, type Field } from './catalog'
import { validateDiscovery, validTime, type DiscoveryState } from './discoveryContract'
import { licensePlanningFields } from './licensingFields'
import { licensingRightsFields } from './licensingRights'
import { licenseCoverageKeys } from './licenseCoverageFields'
import { licenseDependencyKeys } from './licenseDependencyFields'
import { emptyContext, managementSources, type ProjectContext } from './workflow'
import {emptyManagementPlan,managementQuestions,deploymentOwners,type ManagementPlan} from './managementAdvisor'
import {omePlanningFields} from './omeFields'
import {managementProductFields,managementSystemFields} from './managementProductFields'
import {hostingContractFields,additionalProducts} from './hostingContractFields'
import type {OmittedComponent} from './componentOmissions'
import {availabilityFields,availabilityMemberFields} from './availabilityFields'
import {availabilityDetailFields,availabilityPlacementFields} from './availabilityDetailFields'
import {identityReadinessFields,mediaReadinessFields,arcReadinessFields} from './readinessFields'
import {hostDeploymentFields,clusterDeploymentFields,provisioningReadinessFields} from './hostDeploymentFields'
import {storageV20Fields} from './storageReadinessFields'
import {networkV21Fields,networkCollections} from './networkDesignFields'
import {operationsFields,operationsCollections} from './operationsFields'
import {networkControlFields} from './networkControlFields'
import {sdnFabricFields,sdnRecordFields,sdnCollections} from './sdnFields'
import {sdnServiceKeys} from './sdnServiceFields'
import {validateSdnEvidenceState,type SdnEvidenceState} from './sdnEvidenceContract'
import {decisionFields,decisionSecretKeys,networkDeviceKeys,networkDecisionV31Fields,STORAGE_LINKS_KEY} from './componentDecisionFields'

export const SCHEMA_VERSION = 32 as const
export const PROJECT_KIND = 'hyperv-configurator-project' as const
export const STORAGE_KEY = 'hyperv-configurator.project.v1'
export const MAX_PROJECT_BYTES = 2 * 1024 * 1024

export const scopes = {
  combined: 'Management plane and clusters',
  management: 'Management plane only',
  cluster: 'Cluster only',
  existing: 'Document an existing environment',
} as const
export const products = {
  ...additionalProducts,
  vmm: 'Virtual Machine Manager', scom: 'Operations Manager', sql: 'SQL Server',
  wac: 'Windows Admin Center', ome: 'Dell OpenManage Enterprise',
  identity: 'Identity and DNS', pki: 'Certificate services', library: 'VMM library',
  pxe: 'PXE / Windows Deployment Services', arc: 'Arc resource bridge', runner: 'Automation runner',
} as const
export const hosts = {
  'hyperv-management': 'Dedicated Hyper-V management cluster',
  'hyperv-workload': 'Hyper-V workload cluster',
  'hyperv-existing': 'Existing Hyper-V fabric',
  vsphere: 'VMware vSphere', vcd: 'VMware Cloud Director',
  physical: 'Dedicated physical server', external: 'Externally supplied service',
} as const
export const lifecycles = {
  new: 'Deploy new', preserve: 'Use existing', configure: 'Configure existing', external: 'Supplied by another team',
} as const
export const controllerArchitectures = {
  'controller-vms': 'Network Controller VMs',
  'host-cluster-role': 'Windows Server 2025 host cluster role',
} as const
export const setupOwners = {
  operator: 'Operator deployment handoff', vmm: 'VMM', powershell: 'PowerShell / SDN Express', existing: 'Existing fabric owner',
} as const

export interface Component {
  id: string
  product: keyof typeof products
  lifecycle: keyof typeof lifecycles
  hosting: keyof typeof hosts
  name: string
  owner: string
  version: string
  placement: string
  failureDomain: string
  endpoint: string
  vCpu: number
  memoryGiB: number
  diskGiB: number
  infrastructureHa: boolean
  applicationHa: string
  recovery: string
  credentialRef: string
  hostingDetails: Answers
  productDetails: Answers
  ome: {
    devices: number
    plugins: string
    discoveryScope: string
    firmwareCatalog: string
    integrations: string
    entitlement: string
    manualSteps: string
  }
}
export interface Project {
  kind: typeof PROJECT_KIND
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  revision: number
  name: string
  owner: string
  environment: 'lab' | 'poc' | 'production' | 'hosted'
  scope: keyof typeof scopes
  createdAt: string
  updatedAt: string
  context: ProjectContext
  managementPlan:ManagementPlan
  requirements: {
    offline: boolean
    bareMetal: boolean
    tenantClouds: boolean
    monitoring: boolean
    browserAdmin: boolean
    managementHa: boolean
    previewsAccepted: boolean
  }
  components: Component[]
  omittedComponents:OmittedComponent[]
  design: DesignData
  discovery: DiscoveryState
  sdnEvidence:SdnEvidenceState
  /** Schema 31: component "is it used?" gates and the follow-up answers they reveal. */
  decisions: Answers
  sdn: {
    details: Answers
    scope: 'none' | 'existing' | 'new' | 'expand'
    architecture: keyof typeof controllerArchitectures
    owner: keyof typeof setupOwners
    osVersion: string
    toolVersion: string
    controllerEndpoint: string
    underlay: string
    vipPool: string
    tenantNetworks: string
    bgpPeers: string
    certificates: string
    loadBalancer: boolean
    gateways: boolean
    securityPolicy: string
    recovery: string
  }
}

export function newProject(): Project {
  const now = new Date().toISOString()
  return {
    kind: PROJECT_KIND, schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), revision: 1,
    name: '', owner: '', environment: 'production', scope: 'combined', createdAt: now, updatedAt: now,
    requirements: { offline: false, bareMetal: false, tenantClouds: false, monitoring: false, browserAdmin: false, managementHa: false, previewsAccepted: false },
    components: [], omittedComponents:[], design: emptyDesign(), sdnEvidence:{entries:[]}, discovery: { snapshots: [], reviews: [] }, context: emptyContext(), managementPlan:emptyManagementPlan(), decisions: defaultAnswers(decisionFields),
    sdn: { details:defaultAnswers(sdnFabricFields), scope: 'none', architecture: 'controller-vms', owner: 'operator', osVersion: '', toolVersion: '', controllerEndpoint: '', underlay: '', vipPool: '', tenantNetworks: '', bgpPeers: '', certificates: '', loadBalancer: false, gateways: false, securityPolicy: '', recovery: '' },
  }
}

export function newComponent(product: Component['product']): Component {
  return {
    id: crypto.randomUUID(), product, lifecycle: 'new', hosting: 'hyperv-management',
    name: '', owner: '', version: '', placement: '', failureDomain: '', endpoint: '',
    vCpu: 0, memoryGiB: 0, diskGiB: 0, infrastructureHa: false,
    applicationHa: '', recovery: '', credentialRef: '',
    hostingDetails: defaultAnswers(hostingFields), productDetails: defaultAnswers(productFields[product]),
    ome: { devices: 0, plugins: '', discoveryScope: '', firmwareCatalog: '', integrations: '', entitlement: '', manualSteps: '' },
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Validate each key against the owned schema instead of merging arbitrary imported properties.
function shape(value: unknown, template: unknown, path: string): void {
  if (record(template)) {
    if (!record(value)) throw new Error(`${path} must be an object.`)
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(template, key)) throw new Error(`${path} contains an unknown field: ${key}.`)
    }
    for (const key of Object.keys(template)) shape(value[key], template[key], `${path}.${key}`)
  } else if (typeof value !== typeof template || (typeof value === 'number' && (!Number.isFinite(value) || value < 0))) {
    throw new Error(`${path} has an invalid value.`)
  } else if (typeof value === 'string' && value.length > 16000) {
    throw new Error(`${path} exceeds the text limit.`)
  }
}

function choice(value: string, options: object, field: string) {
  if (!Object.prototype.hasOwnProperty.call(options, value)) throw new Error(`Unknown ${field}: ${value}.`)
}

export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MiB import limit.')
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('Choose a valid Configurator JSON project.') }
  if (!record(raw) || raw.kind !== PROJECT_KIND) throw new Error('This is not a Hyper-V Configurator project.')
  if (raw.schemaVersion === 1) {
    // V1 has no structured availability or dependency records. Never infer these from prose.
    if (!record(raw.design)) throw new Error('Invalid design collections.')
    const additions = ['availabilityGroups', 'availabilityMembers', 'dependencies']
    if (additions.some(key => Object.prototype.hasOwnProperty.call(raw.design, key))) throw new Error('Schema 1 cannot contain schema 2 design collections.')
    raw.design = { ...raw.design, ...Object.fromEntries(additions.map(key => [key, []])) }
    raw.schemaVersion = 2
  }
  if (raw.schemaVersion === 2) {
    if (!record(raw.design)) throw new Error('Invalid design collections.')
    for (const [collection, keys] of Object.entries({ hosts: ['managementAdapter', 'bmcRunAsId'], profiles: ['vmmModuleVersion', 'hostGroupId', 'logicalNetworkId'] })) {
      const rows = raw.design[collection]
      if (!Array.isArray(rows)) throw new Error(`Invalid ${collection} inventory.`)
      for (const row of rows) {
        if (!record(row) || !record(row.values)) throw new Error(`Invalid ${collection} record.`)
        if (keys.some(key => Object.prototype.hasOwnProperty.call(row.values, key))) throw new Error('Schema 2 cannot contain schema 3 VMM fields.')
        row.values = { ...row.values, ...Object.fromEntries(keys.map(key => [key, ''])) }
      }
    }
    raw.schemaVersion = 3
  }
  if (raw.schemaVersion === 3) {
    if (Object.prototype.hasOwnProperty.call(raw,'discovery')) throw new Error('Schema 3 cannot contain schema 4 discovery history.')
    raw.discovery = { snapshots: [], reviews: [] }
    raw.schemaVersion = 4
  }
  if (raw.schemaVersion === 4) {
    if (!record(raw.design) || !Array.isArray(raw.design.clusters)) throw new Error('Invalid cluster inventory.')
    const keys = ['clusterModuleVersion', 'seedHost', 'domainFqdn', 'managementNetwork']
    for (const row of raw.design.clusters) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid cluster record.')
      if (keys.some(key => Object.prototype.hasOwnProperty.call(row.values, key))) throw new Error('Schema 4 cannot contain schema 5 cluster fields.')
      row.values = { ...row.values, ...Object.fromEntries(keys.map(key => [key, ''])) }
    }
    raw.schemaVersion = 5
  }
  if (raw.schemaVersion === 5) {
    if (!record(raw.design) || !Array.isArray(raw.design.clusters)) throw new Error('Invalid cluster inventory.')
    const keys = ['quorumAction','witnessSharePath','witnessShareIdentity','witnessAuthRef','witnessAccountName','witnessEndpoint','witnessDiskResourceId','witnessDiskVolume','witnessPlacement','witnessPrerequisites','witnessAcceptance']
    for (const row of raw.design.clusters) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid cluster record.')
      if (keys.some(key => Object.prototype.hasOwnProperty.call(row.values,key))) throw new Error('Schema 5 cannot contain schema 6 witness fields.')
      row.values = { ...row.values, ...Object.fromEntries(keys.map(key=>[key,key==='quorumAction'?'preserve':''])) }
    }
    raw.schemaVersion = 6
  }
  if (raw.schemaVersion === 6) {
    if (!record(raw.design) || !Array.isArray(raw.design.volumes) || !Array.isArray(raw.design.storageSystems)) throw new Error('Invalid storage inventory.')
    const additions = ['storagePaths', 'storageAllocations', 'sanPaths']
    if (additions.some(key => Object.prototype.hasOwnProperty.call(raw.design, key))) throw new Error('Schema 6 cannot contain schema 7 storage collections.')
    for (const row of raw.design.storageSystems) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid storage system record.')
      if (Object.prototype.hasOwnProperty.call(row.values,'localHost')) throw new Error('Schema 6 cannot contain schema 7 storage fields.')
      row.values = {...row.values,localHost:''}
    }
    const fields = collections.find(c => c.key === 'volumes')!.fields.filter(f => ['lifecycle','sourceIdentity','currentSizeGiB','currentResiliency','currentPath','currentProvisioning','replacementApproval','parityLayout','parityMedia','mirrorTierGiB','parityTierGiB','parityColumns','layoutEvidence'].includes(f.key))
    for (const row of raw.design.volumes) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid volume record.')
      if (fields.some(f => Object.prototype.hasOwnProperty.call(row.values, f.key))) throw new Error('Schema 6 cannot contain schema 7 storage fields.')
      // An old capacity design contains no authorization or structured placement. Leave intent unset.
      row.values = { ...row.values, ...defaultAnswers(fields) }
    }
    raw.design = { ...raw.design, ...Object.fromEntries(additions.map(key => [key, []])) }
    raw.schemaVersion = 7
  }
  if (raw.schemaVersion === 7) {
    if (!record(raw.design) || !Array.isArray(raw.design.profiles)) throw new Error('Invalid provisioning profiles.')
    for (const row of raw.design.profiles) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid provisioning profile.')
      if (profileCreationFields.some(f => Object.prototype.hasOwnProperty.call(row.values, f.key))) throw new Error('Schema 7 cannot contain schema 8 profile creation fields.')
      row.values = { ...row.values, ...defaultAnswers(profileCreationFields) }
    }
    raw.schemaVersion = 8
  }
  if (raw.schemaVersion === 8) {
    if (!record(raw.design) || !Array.isArray(raw.design.licenses)) throw new Error('Invalid licensing inventory.')
    if (Object.prototype.hasOwnProperty.call(raw.design,'licenseAssignments')) throw new Error('Schema 8 cannot contain schema 9 license assignments.')
    for (const row of raw.design.licenses) {
      if (!record(row) || !record(row.values)) throw new Error('Invalid license item.')
      if (licensePlanningFields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key))) throw new Error('Schema 8 cannot contain schema 9 license planning fields.')
      row.values={...row.values,...defaultAnswers(licensePlanningFields)}
    }
    raw.design={...raw.design,licenseAssignments:[]}
    raw.schemaVersion=9
  }
  if(raw.schemaVersion===9){
    if(Object.prototype.hasOwnProperty.call(raw,'context'))throw new Error('Schema 9 cannot contain schema 10 project context.')
    raw.context=emptyContext();raw.schemaVersion=10
  }
  if(raw.schemaVersion===10){
    if(Object.prototype.hasOwnProperty.call(raw,'managementPlan'))throw new Error('Schema 10 cannot contain schema 11 management questions.')
    raw.managementPlan=emptyManagementPlan();raw.schemaVersion=11
  }
  if(raw.schemaVersion===11){
    if(!Array.isArray(raw.components))throw new Error('Invalid management inventory.')
    for(const c of raw.components){
      if(!record(c))throw new Error('Invalid component.')
      if(c.product!=='ome')continue
      if(!record(c.productDetails))throw new Error('Invalid OME product details.')
      if(omePlanningFields.some(f=>Object.prototype.hasOwnProperty.call(c.productDetails,f.key)))throw new Error('Schema 11 cannot contain schema 12 OME planning fields.')
      c.productDetails={...c.productDetails,...defaultAnswers(omePlanningFields)}
    }
    raw.schemaVersion=12
  }
  if(raw.schemaVersion===12){
    if(!Array.isArray(raw.components))throw new Error('Invalid management inventory.')
    for(const c of raw.components){
      if(!record(c)||typeof c.product!=='string')throw new Error('Invalid component.')
      if(c.product==='ome')continue
      if(!record(c.productDetails))throw new Error('Invalid product details.')
      const fields=[...managementSystemFields,...(managementProductFields[c.product]||[])]
      if(fields.some(f=>Object.prototype.hasOwnProperty.call(c.productDetails,f.key)))throw new Error('Schema 12 cannot contain schema 13 management-role fields.')
      c.productDetails={...c.productDetails,...defaultAnswers(fields)}
    }
    raw.schemaVersion=13
  }
  if(raw.schemaVersion===13){
    if(!record(raw.design)||!Array.isArray(raw.components))throw new Error('Invalid hosting inventory.')
    if(Object.prototype.hasOwnProperty.call(raw.design,'managementNetworks'))throw new Error('Schema 13 cannot contain schema 14 component network attachments.')
    for(const c of raw.components){
      if(!record(c)||!record(c.hostingDetails))throw new Error('Invalid component hosting details.')
      if(typeof c.product==='string'&&Object.prototype.hasOwnProperty.call(additionalProducts,c.product))throw new Error('Schema 13 cannot contain schema 14 component categories.')
      if(hostingContractFields.some(f=>Object.prototype.hasOwnProperty.call(c.hostingDetails,f.key)))throw new Error('Schema 13 cannot contain schema 14 hosting contract fields.')
      c.hostingDetails={...c.hostingDetails,...defaultAnswers(hostingContractFields)}
    }
    raw.design={...raw.design,managementNetworks:[]};raw.schemaVersion=14
  }
  if(raw.schemaVersion===14){
    if(Object.prototype.hasOwnProperty.call(raw,'omittedComponents'))throw new Error('Schema 14 cannot contain schema 15 omitted components.')
    raw.omittedComponents=[];raw.schemaVersion=15
  }
  if(raw.schemaVersion===15){
    if(!record(raw.design))throw new Error('Invalid availability inventory.')
    for(const [key,fields] of [['availabilityGroups',availabilityFields],['availabilityMembers',availabilityMemberFields]] as const){
      const rows=raw.design[key]
      if(!Array.isArray(rows))throw new Error('Invalid availability inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid availability record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key))||(key==='availabilityMembers'&&row.values.role==='observer'))throw new Error('Schema 15 cannot contain schema 16 availability fields or observer roles.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.schemaVersion=16
  }
  if(raw.schemaVersion===16){
    if(!record(raw.design)||Object.prototype.hasOwnProperty.call(raw.design,'availabilityDatabases'))throw new Error('Schema 16 cannot contain schema 17 database assignments.')
    for(const [key,fields]of [['availabilityGroups',availabilityDetailFields],['availabilityMembers',availabilityPlacementFields]]as const){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid availability inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid availability record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key))||(key==='availabilityGroups'&&row.values.strategy==='filecluster'))throw new Error('Schema 16 cannot contain schema 17 availability fields or library cluster strategies.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.design={...raw.design,availabilityDatabases:[]};raw.schemaVersion=17
  }
  if(raw.schemaVersion===17){
    if(!record(raw.design)||!Array.isArray(raw.components)||!Array.isArray(raw.omittedComponents))throw new Error('Invalid prerequisite inventory.')
    if(['identityBindings','mediaBindings'].some(key=>Object.prototype.hasOwnProperty.call(raw.design,key)))throw new Error('Schema 17 cannot contain schema 18 prerequisite assignments.')
    for(const [key,fields]of [['identities',identityReadinessFields],['media',mediaReadinessFields]]as const){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid prerequisite inventory.')
      for(const row of rows){if(!record(row)||!record(row.values))throw new Error('Invalid prerequisite record.');if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 17 cannot contain schema 18 prerequisite fields.');row.values={...row.values,...defaultAnswers(fields)}}
    }
    for(const c of [...raw.components,...raw.omittedComponents.map(row=>record(row)?row.component:null)]){
      if(!record(c))throw new Error('Invalid component.');if(c.product!=='arc')continue
      if(!record(c.productDetails))throw new Error('Invalid Arc details.')
      if(arcReadinessFields.some(f=>Object.prototype.hasOwnProperty.call(c.productDetails,f.key)))throw new Error('Schema 17 cannot contain schema 18 Arc fields.')
      c.productDetails={...c.productDetails,...defaultAnswers(arcReadinessFields)}
    }
    raw.design={...raw.design,identityBindings:[],mediaBindings:[]};raw.schemaVersion=18
  }
  if(raw.schemaVersion===18){
    if(!record(raw.design))throw new Error('Invalid host deployment inventory.')
    for(const [key,fields]of [['hosts',hostDeploymentFields],['clusters',clusterDeploymentFields],['profiles',provisioningReadinessFields]]as const){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid host deployment inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid host deployment record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key))||(key==='clusters'&&row.values.startingState==='mixed'))throw new Error('Schema 18 cannot contain schema 19 host deployment fields or mixed starting state.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.schemaVersion=19
  }
  if(raw.schemaVersion===19){
    if(!record(raw.design)||Object.prototype.hasOwnProperty.call(raw.design,'storageInterfaces'))throw new Error('Schema 19 cannot contain schema 20 storage interfaces.')
    for(const [key,fields]of storageV20Fields){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid storage readiness inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid storage readiness record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 19 cannot contain schema 20 storage readiness fields.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.design={...raw.design,storageInterfaces:[]};raw.schemaVersion=20
  }
  if(raw.schemaVersion===20){
    if(!record(raw.design)||networkCollections.some(c=>Object.prototype.hasOwnProperty.call(raw.design,c.key)))throw new Error('Schema 20 cannot contain schema 21 network mappings.')
    for(const [key,fields]of networkV21Fields){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid network design inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid network design record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 20 cannot contain schema 21 network fields.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.design={...raw.design,...Object.fromEntries(networkCollections.map(c=>[c.key,[]]))};raw.schemaVersion=21
  }
  if(raw.schemaVersion===21){
    if(!record(raw.design)||operationsCollections.some(c=>Object.prototype.hasOwnProperty.call(raw.design,c.key)))throw new Error('Schema 21 cannot contain schema 22 operations mappings.')
    const rows=raw.design.operations;if(!Array.isArray(rows))throw new Error('Invalid operations inventory.')
    for(const row of rows){
      if(!record(row)||!record(row.values))throw new Error('Invalid operations record.')
      if(operationsFields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 21 cannot contain schema 22 operations fields.')
      row.values={...row.values,...defaultAnswers(operationsFields)}
    }
    raw.design={...raw.design,...Object.fromEntries(operationsCollections.map(c=>[c.key,[]]))};raw.schemaVersion=22
  }
  if(raw.schemaVersion===22){
    if(!record(raw.design)||Object.prototype.hasOwnProperty.call(raw.design,'networkTrafficClasses'))throw new Error('Schema 22 cannot contain schema 23 network traffic classes.')
    for(const [key,fields]of networkControlFields){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid network controls inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid network controls record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 22 cannot contain schema 23 network controls.')
        row.values={...row.values,...defaultAnswers([...fields])}
      }
    }
    raw.design={...raw.design,networkTrafficClasses:[]};raw.schemaVersion=23
  }
  if(raw.schemaVersion===23){
    if(!record(raw.sdn)||!record(raw.design)||Object.prototype.hasOwnProperty.call(raw.sdn,'details')||sdnCollections.some(c=>Object.prototype.hasOwnProperty.call(raw.design,c.key)))throw new Error('Schema 23 cannot contain schema 24 SDN contracts.')
    for(const [key,fields]of sdnRecordFields){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid SDN inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid SDN record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 23 cannot contain schema 24 SDN fields.')
        row.values={...row.values,...defaultAnswers(fields)}
      }
    }
    raw.sdn={...raw.sdn,details:defaultAnswers(sdnFabricFields.filter(f=>!sdnArchitectureKeys.includes(f.key)))}
    raw.design={...raw.design,...Object.fromEntries(sdnCollections.map(c=>[c.key,[]]))};raw.schemaVersion=24
  }
  if(raw.schemaVersion===24){
    if(!record(raw.design)||sdnServiceKeys.some(key=>Object.prototype.hasOwnProperty.call(raw.design,key)))throw new Error('Schema 24 cannot contain schema 25 SDN service objects.')
    raw.design={...raw.design,...Object.fromEntries(sdnServiceKeys.map(key=>[key,[]]))};raw.schemaVersion=25
  }
  if(raw.schemaVersion===25){
    if(Object.prototype.hasOwnProperty.call(raw,'sdnEvidence'))throw new Error('Schema 25 cannot contain schema 26 SDN evidence.');raw.sdnEvidence={entries:[]};raw.schemaVersion=26
  }
  if(raw.schemaVersion===26){
    if(!record(raw.sdn)||!record(raw.sdn.details))throw new Error('Invalid schema 26 SDN details.')
    const details=raw.sdn.details
    if(sdnArchitectureKeys.some(key=>Object.prototype.hasOwnProperty.call(details,key)))throw new Error('Schema 26 cannot contain schema 27 SDN architecture decisions.')
    raw.sdn.details={...raw.sdn.details,...defaultAnswers(sdnArchitectureFields)};raw.schemaVersion=27
  }
  if(raw.schemaVersion===27){
    if(!record(raw.design)||!Array.isArray(raw.design.licenses))throw new Error('Invalid license inventory.')
    for(const row of raw.design.licenses){
      if(!record(row)||!record(row.values))throw new Error('Invalid license record.')
      if(licensingRightsFields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 27 cannot contain schema 28 commercial rights fields.')
      row.values={...row.values,...defaultAnswers(licensingRightsFields)}
    }
    raw.schemaVersion=28
  }
  if(raw.schemaVersion===28){
    if(!record(raw.design)||licenseCoverageKeys.some(key=>Object.prototype.hasOwnProperty.call(raw.design,key)))throw new Error('Schema 28 cannot contain schema 29 license coverage objects.')
    raw.design={...raw.design,...Object.fromEntries(licenseCoverageKeys.map(key=>[key,[]]))};raw.schemaVersion=29
  }
  if(raw.schemaVersion===29){
    if(!record(raw.design)||licenseDependencyKeys.some(key=>Object.prototype.hasOwnProperty.call(raw.design,key)))throw new Error('Schema 29 cannot contain schema 30 license dependency objects.')
    raw.design={...raw.design,...Object.fromEntries(licenseDependencyKeys.map(key=>[key,[]]))};raw.schemaVersion=30
  }
  if(raw.schemaVersion===30){
    // Schema 31 adds component decisions, network device records, port maps and storage connectivity. Every gate starts unanswered.
    if(Object.prototype.hasOwnProperty.call(raw,'decisions')||!record(raw.design)||networkDeviceKeys.some(key=>Object.prototype.hasOwnProperty.call(raw.design,key)))throw new Error('Schema 30 cannot contain schema 31 component decisions or network device records.')
    for(const [key,fields]of networkDecisionV31Fields){
      const rows=raw.design[key];if(!Array.isArray(rows))throw new Error('Invalid network decision inventory.')
      for(const row of rows){
        if(!record(row)||!record(row.values))throw new Error('Invalid network decision record.')
        if(fields.some(f=>Object.prototype.hasOwnProperty.call(row.values,f.key)))throw new Error('Schema 30 cannot contain schema 31 port map or storage connectivity fields.')
        row.values={...row.values,...defaultAnswers([...fields])}
      }
    }
    raw.decisions=defaultAnswers(decisionFields)
    raw.design={...raw.design,...Object.fromEntries(networkDeviceKeys.map(key=>[key,[]]))};raw.schemaVersion=31
  }
  if(raw.schemaVersion===31){
    // Schema 32 adds the switchless S2D cable map. No links are inferred from adapters or port counts.
    if(!record(raw.design)||Object.prototype.hasOwnProperty.call(raw.design,STORAGE_LINKS_KEY))throw new Error('Schema 31 cannot contain schema 32 switchless storage links.')
    raw.design={...raw.design,[STORAGE_LINKS_KEY]:[]};raw.schemaVersion=32
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported project schema. Open this file with a compatible Configurator version.')
  if (!Array.isArray(raw.components) || raw.components.length > 1000) throw new Error('Invalid management inventory or more than 1,000 components.')
  const template = newProject()
  const { components, omittedComponents, design, discovery, sdnEvidence, ...header } = raw
  const { components: _ignored, omittedComponents:_omitted, design: _design, discovery: _discovery, sdnEvidence:_sdnEvidence, ...headerTemplate } = template
  if(!Array.isArray(omittedComponents)||components.length+omittedComponents.length>1000)throw new Error('Active and omitted components together may contain at most 1,000 records.')
  for(const row of omittedComponents){
    if(!record(row)||!record(row.component))throw new Error('Invalid omitted component.')
    const {component,...decision}=row
    shape(decision,{reason:'',reviewOwner:'',omittedAt:''},'omission decision')
    if(!validTime(decision.omittedAt)||Date.parse(decision.omittedAt)>Date.now())throw new Error('Omission time must be a valid, non-future UTC timestamp.')
  }
  const allComponents=[...components,...omittedComponents.map(row=>row.component)]
  shape(header, headerTemplate, 'project')
  choice((raw.context as unknown as ProjectContext).managementSource,{'':'Unspecified',...managementSources},'management source')
  validateSdnEvidenceState(sdnEvidence,String(raw.id))
  validateDiscovery(discovery)
  if (discovery.snapshots.some(entry => entry.snapshot.projectId !== raw.id)) throw new Error('Discovery history belongs to another project.')
  for (const component of allComponents) {
    if (!record(component) || typeof component.product !== 'string') throw new Error('Invalid component product.')
    choice(component.product, products, 'product')
    shape(component, newComponent(component.product as Component['product']), 'component')
    validateAnswers(component.hostingDetails, hostingFields, 'hosting')
    validateAnswers(component.productDetails, productFields[component.product], 'product')
  }
  if (!record(design) || Object.keys(design).some(key => !collections.some(c => c.key === key))) throw new Error('Invalid design collections.')
  const recordIds = new Set<string>()
  for (const collection of collections) {
    const rows = design[collection.key]
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error(`Invalid ${collection.title} inventory.`)
    for (const row of rows) {
      if (!record(row) || Object.keys(row).some(k => k !== 'id' && k !== 'values') || typeof row.id !== 'string' || !row.id || row.id === '0' || row.id === '1' || row.id.startsWith('edge-') || recordIds.has(row.id)) throw new Error('Design records require unique non-reserved IDs and known fields.')
      recordIds.add(row.id)
      validateAnswers(row.values, collection.fields, collection.title)
    }
  }
  const project = raw as unknown as Project
  choice(project.scope, scopes, 'scope')
  choice(project.managementPlan.deploymentOwner,{'':'Unspecified',...deploymentOwners},'OS deployment owner')
  for(const key of Object.keys(managementQuestions))choice(project.managementPlan.answers[key as keyof typeof managementQuestions],{'':'Unanswered',yes:'Yes',no:'No'},'management decision '+key)
  choice(project.environment, { lab: 1, poc: 1, production: 1, hosted: 1 }, 'environment')
  choice(project.sdn.scope, { none: 1, existing: 1, new: 1, expand: 1 }, 'SDN scope')
  choice(project.sdn.architecture, controllerArchitectures, 'controller architecture')
  choice(project.sdn.owner, setupOwners, 'setup owner')
  validateAnswers(project.sdn.details,sdnFabricFields,'SDN fabric')
  validateAnswers(project.decisions,decisionFields,'component decisions')
  if (!project.id || !Number.isInteger(project.revision) || project.revision < 1 || !Number.isFinite(Date.parse(project.createdAt)) || !Number.isFinite(Date.parse(project.updatedAt))) throw new Error('Invalid project identity, revision or timestamps.')
  const ids = new Set<string>(recordIds)
  for (const c of [...project.components,...project.omittedComponents.map(row=>row.component)]) {
    choice(c.product, products, 'product')
    choice(c.hosting, hosts, 'hosting platform')
    choice(c.lifecycle, lifecycles, 'lifecycle')
    if (!c.id || ids.has(c.id) || c.id === '0' || c.id === '1' || c.id.startsWith('edge-')) throw new Error('Every component must have a unique, non-empty, non-reserved ID.')
    ids.add(c.id)
    if (c.credentialRef && !/^(keyvault|secret-ref):\/\/[^\s]+$/.test(c.credentialRef)) throw new Error('Credentials must be keyvault:// or secret-ref:// references.')
    if (c.product === 'ome' && c.hosting === 'physical') throw new Error('OME requires supported appliance hosting, not a physical Windows installation.')
    if (c.product === 'ome' && c.hostingDetails.installProduct) throw new Error('OME appliance installation remains manual.')
  }
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|token|client_secret|connection_string)\s*[:=]\s*(?!keyvault:\/\/|secret-ref:\/\/)[^\s"]+)/i.test(text)) throw new Error('Remove secret literals. Use runtime secret references only.')
  return project
}

function validateAnswers(value: unknown, fields: Field[], path: string): void {
  shape(value, defaultAnswers(fields), path)
  const answers = value as Answers
  for (const field of fields) {
    const answer = answers[field.key]
    if (field.options && answer !== '') choice(String(answer), field.options, field.label)
    if(field.key==='activationRef'&&typeof answer==='string'&&/\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b/i.test(answer))throw new Error('Activation must use an external runtime reference, never a product key.')
    if (typeof answer === 'number' && (answer > (field.max ?? 1e9) || !Number.isFinite(answer))) throw new Error(`${field.label} is outside its allowed range.`)
    if ((/credentialRef|authRef|domainJoinRef|bmcCredentialRef/i.test(field.key)||decisionSecretKeys.includes(field.key)) && answer && !/^(keyvault|secret-ref):\/\/[^\s]+$/.test(String(answer))) throw new Error(`${field.label} must use keyvault:// or secret-ref://.`)
    if(['proxyEndpoint','source'].includes(field.key)&&typeof answer==='string'){
      let url:URL|undefined;try{url=new URL(answer)}catch{/* Non-URL artifact references are retained. */}
      if(url&&(url.username||url.password||[...url.searchParams.keys()].some(key=>/^(sig|token|access_token|client_secret|password)$/i.test(key))))throw new Error(`${field.label} must not contain credentials or signed access tokens. Use a separate runtime credential reference.`)
    }
  }
}

export function serializeProject(project: Project): string {
  const text = JSON.stringify(project, null, 2)
  parseProject(text)
  return text
}

export function componentTotals(project: Project) {
  const total = project.components.reduce((total, c) => ({
    instances: total.instances + 1,
    vCpu: total.vCpu + (c.hosting === 'physical' || c.hosting === 'external' ? 0 : c.vCpu),
    memoryGiB: total.memoryGiB + c.memoryGiB,
    diskGiB: total.diskGiB + c.diskGiB,
  }), { instances: 0, vCpu: 0, memoryGiB: 0, diskGiB: 0 })
  if (project.sdn.scope !== 'none') {
    for (const row of project.design.sdnResources) {
      if (row.values.role !== 'hostcontroller') total.instances += 1
      total.vCpu += Number(row.values.vCpu)
      total.memoryGiB += Number(row.values.memoryGiB)
      total.diskGiB += Number(row.values.diskGiB)
    }
  }
  return total
}
