import {identityReadinessFields,mediaReadinessFields,arcReadinessFields} from '../readinessFields'
import {removeHostDeploymentV19} from './legacyHostDeployment'
export function removeReadinessV18(project:any){
  removeHostDeploymentV19(project)
  if(project.design){delete project.design.identityBindings;delete project.design.mediaBindings}
  for(const [key,fields]of [['identities',identityReadinessFields],['media',mediaReadinessFields]]as const)for(const row of project.design?.[key]||[])for(const field of fields)delete row.values[field.key]
  for(const c of [...project.components||[],...(project.omittedComponents||[]).map((row:any)=>row.component)])if(c.product==='arc')for(const field of arcReadinessFields)delete c.productDetails[field.key]
}
