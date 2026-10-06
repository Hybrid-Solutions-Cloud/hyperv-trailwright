import {collections,sections} from './catalog'
import type {Project} from './project'
import type {Finding} from './validation'

export const managementSources={existing:'Existing management services',external:'Supplied by another team',notrequired:'Management service not required',deferred:'Management decision deferred'} as const
export const contextLabels={scenarioId:'Scenario / engagement identifier',customer:'Customer / business context',naming:'Naming convention',supportTarget:'Support target and acceptance owner',managementOwner:'Management service / decision owner',managementEvidence:'Management boundary, dependencies and acceptance'} as const
export interface ProjectContext {scenarioId:string;customer:string;naming:string;supportTarget:string;managementSource:''|keyof typeof managementSources;managementOwner:string;managementEvidence:string}
export function emptyContext():ProjectContext{return {scenarioId:'',customer:'',naming:'',supportTarget:'',managementSource:'',managementOwner:'',managementEvidence:''}}

export function needsManagementHosts(project:Project){return project.components.some(c=>['hyperv-management','hyperv-workload'].includes(c.hosting))}

/** Skip only empty, inapplicable editors. Existing records and review destinations remain reachable. */
export function workflowSections(project:Project,showAll=false,current?:string){
  if(showAll||project.scope==='combined'||project.scope==='existing')return [...sections]
  return sections.filter(section=>{
    if(section.key===current)return true
    if(collections.some(c=>c.section===section.key&&project.design[c.key].length))return true
    if(project.scope==='management'){
      if(section.key==='hardware')return needsManagementHosts(project)||project.requirements.bareMetal
      if(section.key==='sdn')return project.sdn.scope!=='none'
    }
    if(project.scope==='cluster'&&['hosting','products'].includes(section.key))return project.components.length>0
    return true
  })
}

export function scopeDescription(project:Project){
  if(project.scope==='management')return needsManagementHosts(project)?'Design the Hyper-V hosting platform required by management. Workload estate design belongs in a combined project.':'Record management placement, external hosting capacity, connectivity and recovery. Host provisioning is optional for this scope.'
  if(project.scope==='cluster')return 'Define the workload platform and identify its existing or external management dependency, or record why management is not required or is deferred.'
  if(project.scope==='existing')return 'Document the resources that exist. Every resource keeps its own lifecycle; choosing this scope does not change a resource or authorize replacement.'
  return 'Design management and workload infrastructure together, including independent bootstrap and recovery dependencies.'
}

export function workflowFindings(project:Project):Finding[]{
  const findings:Finding[]=[]
  const add=(code:string,section:string,message:string,fieldKey?:string,severity:Finding['severity']='error')=>findings.push({code,section,message,...(fieldKey?{fieldKey}:{}),severity})
  if((['combined','cluster'].includes(project.scope)||project.scope==='management'&&needsManagementHosts(project))&&!project.design.clusters.length)add('CLUSTER_REQUIRED','topology','Add the cluster or standalone platform required by this design.')
  if(['combined','management'].includes(project.scope)&&!project.components.length)add('MANAGEMENT_REQUIRED','management','Select management components or document externally supplied services.')
  if(project.scope==='existing'&&!project.components.length&&!project.design.clusters.length)add('EXISTING_INVENTORY','project','Add the existing management service or host platform being documented.')
  if(project.scope==='cluster'){
    const context=project.context
    if(!context.managementSource)add('MANAGEMENT_BOUNDARY','management','Choose how this cluster obtains management services.','managementSource')
    if(!context.managementOwner.trim())add('MANAGEMENT_BOUNDARY_OWNER','management','Assign the management service or decision owner.','managementOwner')
    if(!context.managementEvidence.trim())add('MANAGEMENT_BOUNDARY_EVIDENCE','management','Record management dependencies, acceptance, or the reason for a deferred or unnecessary service.','managementEvidence')
    if(context.managementSource==='deferred')add('MANAGEMENT_DEFERRED','management','Management remains deferred; resolve the dependency before deployment.','managementSource','warning')
    if(context.managementSource==='notrequired'&&(project.components.length||project.requirements.bareMetal||project.requirements.tenantClouds||project.requirements.monitoring||project.requirements.browserAdmin||project.requirements.managementHa||project.sdn.owner==='vmm'&&project.sdn.scope!=='none'))add('MANAGEMENT_BOUNDARY_CONFLICT','management','Management is marked not required but components or management capabilities remain selected. Review the boundary and retained choices.','managementSource')
  }
  return findings
}
