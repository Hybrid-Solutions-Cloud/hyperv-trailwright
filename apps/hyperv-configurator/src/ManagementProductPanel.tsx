import type {Project} from './project'
import {managementProductPlan} from './managementProductPlan'
export function ManagementProductPanel({project,componentId}:{project:Project;componentId:string}){
  const component=managementProductPlan(project).components.find(c=>c.componentId===componentId)
  if(!component)return null
  return <section className="notice" aria-label="Management role review"><h3>Role and dependency review</h3>
    <p>{component.configurationRequested?'Installation or integration is selected. Complete the applicable role inputs before handoff.':'This component is documented without a product installation or integration request.'}</p>
    <p>{component.findings.length} role inputs or compatibility reviews remain. Existing dependencies are referenced explicitly; no supporting service is created automatically.</p>
    <p>Answers retained from other roles remain visible. The selected primary role controls required inputs; co-located roles need their own review.</p>
    <p>Review the exact OS, role and product build together. Runtime installation and recovery acceptance require separate evidence.</p>
  </section>
}
