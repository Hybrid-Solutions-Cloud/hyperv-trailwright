import type {Component,Project} from './project'
import type {Finding} from './validation'

export interface OmittedComponent {component:Component;reason:string;reviewOwner:string;omittedAt:string}
export type OmissionProject=Project&{omittedComponents:OmittedComponent[]}

/** Move the existing record; preserve identity, configuration and references for a reversible decision. */
export function omitComponent(project:OmissionProject,componentId:string):OmissionProject{
  const component=project.components.find(c=>c.id===componentId)
  if(!component)throw new Error('The active component no longer exists.')
  if(project.omittedComponents.some(row=>row.component.id===componentId))throw new Error('The component is already omitted.')
  return {...project,components:project.components.filter(c=>c.id!==componentId),omittedComponents:[...project.omittedComponents,{component:structuredClone(component),reason:'',reviewOwner:'',omittedAt:new Date().toISOString()}]}
}
export function restoreComponent(project:OmissionProject,componentId:string):OmissionProject{
  const row=project.omittedComponents.find(row=>row.component.id===componentId)
  if(!row)throw new Error('The omitted component no longer exists.')
  if(project.components.some(c=>c.id===componentId))throw new Error('An active component already uses this identity.')
  return {...project,components:[...project.components,structuredClone(row.component)],omittedComponents:project.omittedComponents.filter(row=>row.component.id!==componentId)}
}
export function omissionFindings(project:OmissionProject):Finding[]{
  return project.omittedComponents.flatMap(row=>{
    const findings:Finding[]=[]
    if(!row.reason.trim())findings.push({code:'COMPONENT_OMISSION_REASON',section:'management',recordId:row.component.id,fieldKey:'omissionReason',severity:'warning',message:(row.component.name||row.component.product)+': Record why this component is omitted from the active design.'})
    if(!row.reviewOwner.trim())findings.push({code:'COMPONENT_OMISSION_OWNER',section:'management',recordId:row.component.id,fieldKey:'omissionOwner',severity:'warning',message:(row.component.name||row.component.product)+': Assign the omission review owner.'})
    return findings
  })
}
export function omissionSummary(project:OmissionProject){return {kind:'hyperv-component-omissions',version:'0.1.0',projectId:project.id,revision:project.revision,meaning:'Omitted components retain their original configuration in the project but are absent from active capacity, product and execution plans. Existing references remain for explicit review; restoring a component does not execute it.',components:project.omittedComponents.map(row=>({componentId:row.component.id,name:row.component.name,product:row.component.product,priorLifecycle:row.component.lifecycle,reason:row.reason,reviewOwner:row.reviewOwner,omittedAt:row.omittedAt,active:false}))}}
