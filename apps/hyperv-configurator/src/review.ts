import { collections, sections, visibleField } from './catalog'
import type { Project } from './project'
import type { Finding } from './validation'
import {recordFields} from './availabilityDetailFields'
import {collectionApplies} from './collectionScope'
import {activeDecisionFields} from './componentDecisions'

export type DesignSection = typeof sections[number]['key']
export interface ReviewTarget { section: DesignSection; recordId?: string; fieldKey?: string }
const fieldsByCode:Record<string,string> = {
  VOLUME_SIZE:'sizeGiB',VOLUME_CONSUMPTION:'usedGiB',VOLUME_PROVISIONING:'provisioning',VOLUME_FILESYSTEM:'filesystem',VOLUME_PATH:'path',VOLUME_PATH_DUPLICATE:'path',VOLUME_LIFECYCLE:'lifecycle',VOLUME_CURRENT_STATE:'sourceIdentity',VOLUME_PRESERVE:'lifecycle',VOLUME_CONVERSION:'lifecycle',VOLUME_REPLACEMENT:'replacementApproval',VOLUME_CREATE_EXISTING:'lifecycle',
  STORAGE_CAPACITY:'usableTiB',STORAGE_USABLE:'usableTiB',STORAGE_RESERVE:'reserveTiB',LOCAL_STORAGE_HOST:'localHost',S2D_RESILIENCY:'resiliency',S2D_RESILIENCY_NODES:'resiliency',S2D_NESTED_NODES:'resiliency',S2D_TIER_REVIEW:'layoutEvidence',S2D_PARITY_LAYOUT:'parityLayout',S2D_PARITY_MEDIA:'parityMedia',S2D_PARITY_COLUMNS:'parityColumns',S2D_TIER_SIZES:'mirrorTierGiB',
  STORAGE_DIRECTORY_PATH:'path',STORAGE_DIRECTORY_DUPLICATE:'path',STORAGE_DIRECTORY_LIFECYCLE:'lifecycle',STORAGE_ALLOCATION_REFERENCE:'resource',STORAGE_ALLOCATION_SIZE:'sizeGiB',STORAGE_ALLOCATION_DUPLICATE:'diskKey',SAN_PATH_TARGET:'volume',SAN_PATH_DUPLICATE:'initiator',SAN_PATH_EVIDENCE:'evidence',SAN_PATH_FAILED:'state',
  STAGE_TARGETS:'targets',STAGE_TARGET_MISSING:'targets',STAGE_TARGET_KIND:'targets',STAGE_DEPENDENCY_MISSING:'dependsOn',STAGE_SELF_DEPENDENCY:'dependsOn',STAGE_ORDER_BLOCKED:'dependsOn',STAGE_FLOATING_VERSION:'version',STAGE_COMPLETION_EVIDENCE:'evidence',
}

/** Resolve findings by their owning record, including storage findings about a workload or component. */
export function reviewTarget(project: Project, finding: Finding): ReviewTarget {
  const collection = collections.find(c=>project.design[c.key].some(r=>r.id===finding.recordId))
  if (collection) return {section:collection.section as DesignSection,recordId:finding.recordId,fieldKey:finding.fieldKey || fieldsByCode[finding.code]}
  const component = project.components.find(c=>c.id===finding.recordId)
  if (component) return {section:['management','hosting','products'].includes(finding.section)?finding.section as DesignSection:'hosting',recordId:component.id,fieldKey:finding.fieldKey}
  const omitted=project.omittedComponents.find(row=>row.component.id===finding.recordId)
  if(omitted)return {section:'management',recordId:omitted.component.id,fieldKey:finding.fieldKey}
  if (finding.code==='PROJECT_NAME') return {section:'project',fieldKey:'name'}
  if (finding.code==='PROJECT_OWNER') return {section:'project',fieldKey:'owner'}
  return {section:sections.some(s=>s.key===finding.section)?finding.section as DesignSection:'review',fieldKey:finding.fieldKey}
}

/** Completion measures supplied required inputs, independently of support or runtime acceptance. */
export function designProgress(project:Project,findings:Finding[]) {
  const counts = new Map<DesignSection,{errors:number;reviews:number}>(sections.map(s=>[s.key,{errors:0,reviews:0}]))
  for(const finding of findings){const count=counts.get(reviewTarget(project,finding).section)!;if(finding.severity==='error')count.errors++;else count.reviews++}
  return sections.map(section=>{
    let required=0,answered=0
    const count=(value:unknown)=>{required++;if(typeof value==='string'?!!value.trim():value!==undefined&&value!==null)answered++}
    if(section.key==='project'){count(project.name);count(project.owner)}
    for(const field of section.key==='network'||section.key==='operations'?activeDecisionFields(project,section.key).filter(f=>f.required):[])count(project.decisions[field.key])
    for(const collection of collections.filter(c=>c.section===section.key && collectionApplies(c,project)))
      for(const row of project.design[collection.key])for(const field of recordFields(project,collection,row.values).filter(f=>f.required&&visibleField(f,row.values)))count(row.values[field.key])
    if(section.key==='management')for(const component of project.components){count(component.name);count(component.owner);count(component.version)}
    if(section.key==='management'&&project.scope==='cluster'){count(project.context.managementSource);count(project.context.managementOwner);count(project.context.managementEvidence)}
    if(section.key==='hosting')for(const component of project.components)count(component.placement)
    const {errors,reviews}=counts.get(section.key)!
    return {section:section.key,title:section.title,required,answered,errors,reviews}
  })
}
