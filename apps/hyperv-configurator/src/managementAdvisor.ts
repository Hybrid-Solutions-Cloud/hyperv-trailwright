import type {Project} from './project'
import type {Finding} from './validation'
import {SUPPORT_SOURCES} from './supportCatalog'

export const managementQuestions={
  preparedHosts:'Create clusters from hosts whose operating systems are already prepared',
  azureVmOperations:'Manage on-premises VMs through Azure portal / ARM / Azure RBAC',
  centralFabric:'Central fabric inventory, placement, images and templates',
  azureReady:'Azure subscription, identity, external DNS and outbound HTTPS are available',
  productionSupport:'Every selected component must be generally available at go-live',
  computeOptimization:'Policy-driven compute, storage or power optimization beyond native balancing',
  storageIntegration:'Array-aware or other vendor integrations are required',
  vmwareConversion:'VMware-to-Hyper-V conversion is part of this engagement',
  conversionConstraints:'Migration has near-zero downtime, vSAN or other tool compatibility constraints',
  largeEstate:'Central governance across many hosts, clusters or sites is required',
  smallEdge:'A small dedicated footprint and simple local operation are priorities',
  softwareDefinedFabric:'Production management of S2D or SDN is required at go-live',
  automation:'Named API / PowerShell / ARM automation workflows are required',
} as const
export type ManagementQuestion=keyof typeof managementQuestions
export type DecisionAnswer=''|'yes'|'no'
export const deploymentOwners={vmm:'VMM BMC / PXE',oem:'Named OEM / external provisioning service',operator:'Operator-managed OS deployment'} as const
export const managementDecisionLabels={decisionOwner:'Management architecture decision owner',decisionEvidence:'Selected management approach and decision evidence',provisioningContract:'OS provisioning tool, version and qualification evidence',tenantInterface:'Tenant interface, quotas, identity and ownership',integrationRequirements:'Vendor integration versions and required operations',migrationPlan:'Migration compatibility, downtime and cutover plan'} as const
export interface ManagementPlan {answers:Record<ManagementQuestion,DecisionAnswer>;deploymentOwner:''|keyof typeof deploymentOwners;decisionOwner:string;decisionEvidence:string;provisioningContract:string;tenantInterface:string;integrationRequirements:string;migrationPlan:string}
export function emptyManagementPlan():ManagementPlan{return {answers:Object.fromEntries(Object.keys(managementQuestions).map(key=>[key,''])) as ManagementPlan['answers'],deploymentOwner:'',decisionOwner:'',decisionEvidence:'',provisioningContract:'',tenantInterface:'',integrationRequirements:'',migrationPlan:''}}
export const ADVISOR_SOURCES={...SUPPORT_SOURCES,bareMetal:'https://learn.microsoft.com/en-us/system-center/vmm/hyper-v-bare-metal?view=sc-vmm-2025',clouds:'https://learn.microsoft.com/en-us/system-center/vmm/deploy-cloud?view=sc-vmm-2025',optimization:'https://learn.microsoft.com/en-us/system-center/vmm/vm-optimization?view=sc-vmm-2025',classic:'https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/remotely-manage-hyper-v-hosts'}
export interface ManagementOption {id:string;name:string;status:'candidate'|'review'|'excluded';rationale:string[];sources:string[]}
export function managementAdvice(project:Project){
  const plan=project.managementPlan,answers=plan.answers,r=project.requirements,options:ManagementOption[]=[],findings:Finding[]=[]
  const add=(code:string,message:string,fieldKey:string,severity:Finding['severity']='error')=>findings.push({code,section:'management',message,fieldKey,severity})
  const option=(id:string,name:string,status:ManagementOption['status'],rationale:string[],sources:string[])=>options.push({id,name,status,rationale,sources})
  const vmmReasons:string[]=[],vmmSources:string[]=[]
  if(r.bareMetal){
    if(!plan.deploymentOwner)add('ADVISOR_OS_OWNER','Choose the owner of bare-metal OS deployment.','deploymentOwner')
    if(!plan.provisioningContract.trim())add('ADVISOR_OS_CONTRACT','Record the OS provisioning tool, version and qualification evidence.','provisioningContract')
    if(plan.deploymentOwner==='vmm'){vmmReasons.push('VMM owns the requested BMC/PXE host provisioning path; complete fabric, image and physical-profile prerequisites.');vmmSources.push(ADVISOR_SOURCES.bareMetal)}
    if(plan.deploymentOwner==='oem')option('oem','OEM / external OS provisioning','review',['The selected external owner needs a named, version-qualified contract. Choosing this path does not qualify a generic Redfish or OEM installer.'],[ADVISOR_SOURCES.bareMetal])
    if(plan.deploymentOwner==='operator')option('operator','Operator OS deployment','candidate',['The operator owns host OS preparation; record installation and handoff acceptance before cluster creation.'],[ADVISOR_SOURCES.classic])
  }
  if(r.tenantClouds){vmmReasons.push('Review VMM cloud capacity, quotas and delegated roles together with the actual tenant interface.');vmmSources.push(ADVISOR_SOURCES.clouds);if(!plan.tenantInterface.trim())add('ADVISOR_TENANT_INTERFACE','Record the tenant interface and its identity, quotas and owner.','tenantInterface')}
  if(answers.centralFabric==='yes'){vmmReasons.push('Central fabric, placement and templates make VMM a candidate; validate the selected roles and existing services.');vmmSources.push(ADVISOR_SOURCES.vmm)}
  if(answers.computeOptimization==='yes'){vmmReasons.push('Review VMM dynamic/power optimization against host, shared-storage and migration prerequisites; site-aware or stretched clusters have restrictions.');vmmSources.push(ADVISOR_SOURCES.optimization)}
  if(answers.azureVmOperations==='yes'){vmmReasons.push('Azure VM operations require the underlying VMM fabric plus Arc-enabled VMM.');vmmSources.push(ADVISOR_SOURCES.arc)}
  if(vmmReasons.length)option('vmm','Virtual Machine Manager','candidate',vmmReasons,[...new Set(vmmSources)])
  if(answers.preparedHosts==='yes'||answers.smallEdge==='yes'||r.offline)option('classic','Native Hyper-V administration','candidate',['Keep a local administration and recovery path. Prepared-host cluster creation is a separate task from installing a host operating system.'],[ADVISOR_SOURCES.classic])
  if(r.browserAdmin){
    option('wac-admin','Windows Admin Center Administration Mode','candidate',['Review browser administration, authentication, extensions and the supported gateway topology. This is not a bare-metal OS installer.'],[ADVISOR_SOURCES.wac])
    option('wac-virtual','Windows Admin Center Virtualization Mode',!r.previewsAccepted||answers.productionSupport==='yes'?'excluded':'review',[!r.previewsAccepted?'Preview evaluation has not been accepted.':answers.productionSupport==='yes'?'Preview cannot satisfy the requested generally available go-live requirement.':'Preview evaluation requires its dedicated gateway, supported Datacenter hosts and feature-by-feature acceptance.','Do not infer production HA or complete S2D/SDN feature coverage from an accepted preview.'],[ADVISOR_SOURCES.wacPreview,ADVISOR_SOURCES.wacHosts])
  }
  if(answers.azureVmOperations==='yes'){
    const blocked=r.offline||answers.azureReady==='no'
    option('arc','Azure Arc-enabled VMM',blocked?'excluded':answers.azureReady==='yes'?'candidate':'review',[blocked?'Azure-dependent VM operations conflict with offline operation or declined Azure readiness.':'Confirm the resource bridge, Azure subscription/RBAC, DNS and ongoing outbound requirements.','Existing VMM remains the underlying fabric; Arc is an additional management surface.'],[ADVISOR_SOURCES.arc])
    if(blocked)add('ADVISOR_ARC_CONFLICT','Azure VM operations conflict with offline operation or declined Azure readiness.','azureVmOperations')
    else if(answers.azureReady!=='yes')add('ADVISOR_ARC_READINESS','Resolve Azure subscription, identity and network readiness for the requested Azure VM operations.','azureReady')
  }
  if(r.monitoring)option('scom','Operations Manager','candidate',['SCOM monitoring has its own management servers, databases, pools, supported roles and recovery design.'],[ADVISOR_SOURCES.scom,ADVISOR_SOURCES.scomSql])
  if(answers.storageIntegration==='yes'&&!plan.integrationRequirements.trim())add('ADVISOR_INTEGRATION','Record exact vendor integration versions and required operations.','integrationRequirements')
  if(answers.vmwareConversion==='yes'&&!plan.migrationPlan.trim())add('ADVISOR_MIGRATION','Record migration compatibility, downtime and cutover acceptance.','migrationPlan')
  if(answers.conversionConstraints==='yes'&&answers.vmwareConversion!=='yes')add('ADVISOR_MIGRATION_SCOPE','Migration constraints are selected without an active conversion workstream.','vmwareConversion')
  if(project.components.some(c=>c.product==='wac'&&c.productDetails.mode==='virtualization')&&(!r.previewsAccepted||answers.productionSupport==='yes'))add('ADVISOR_SELECTED_PREVIEW','Selected WAC Virtualization Mode conflicts with preview or generally available support requirements.','productionSupport')
  if(!plan.decisionOwner.trim())add('ADVISOR_OWNER','Assign the management architecture decision owner.','decisionOwner','warning')
  if(!plan.decisionEvidence.trim())add('ADVISOR_DECISION','Record the selected management approach and its decision evidence.','decisionEvidence','warning')
  const unanswered=Object.keys(managementQuestions).filter(key=>!answers[key as ManagementQuestion])
  if(unanswered.length)add('ADVISOR_UNANSWERED',unanswered.length+' management decisions remain unanswered. Review the applicable requirements.',unanswered[0],'warning')
  const reviews=[
    ...(answers.largeEstate==='yes'?['Validate central governance and exact scale limits; host count alone does not certify a management product.']:[]),
    ...(answers.softwareDefinedFabric==='yes'?['Review each required S2D/SDN operation against the exact management mode and controller architecture.']:[]),
    ...(answers.automation==='yes'?['Map each required automation operation to a named, pinned consumer; contract checks do not establish runtime qualification.']:[]),
    ...(r.managementHa?['Design application, database and infrastructure recovery separately with RTO/RPO and failure-domain evidence.']:[]),
    ...(answers.preparedHosts==='yes'&&r.bareMetal?['Mixed starting states are allowed; map prepared and bare-metal hosts individually.']:[]),
    ...(answers.vmwareConversion==='yes'?['Migration is a separate workstream; do not treat conversion tooling as a permanent fabric requirement.']:[]),
  ]
  return {kind:'hyperv-management-advice',schemaVersion:1,version:'0.1.0',reviewedAt:'2026-09-11',projectId:project.id,projectRevision:project.revision,options,findings,unanswered,reviews,commercialReview:['Review existing Windows/System Center coverage before adding purchase quantities.','Supporting SQL use, separate SQL rights, access rights and HA restrictions require the licensing owner; selecting a component does not create an entitlement.','Arc services and OME/vendor integrations have separately reviewed charges or entitlements; no price or inclusion is inferred.'],meaning:'Planning candidates derived from selected requirements. They do not add components, qualify support, assign licenses or execute infrastructure. Unanswered decisions remain visible.'}
}
