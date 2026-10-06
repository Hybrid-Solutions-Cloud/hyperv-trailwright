import type {Project} from './project'
import {hostingPlan} from './hostingPlan'
export function HostingPanel({project,componentId}:{project:Project;componentId:string}){
  const plan=hostingPlan(project),component=plan.components.find(c=>c.componentId===componentId)
  if(!component)return null
  return <section className="notice" aria-label="Component hosting and ownership"><h3>Hosting and action ownership</h3>
    <p>Assign each selected action separately. Provider IDs identify existing resources or placement targets; a name or downloaded plan does not create them.</p>
    <ul>{component.actions.map(a=><li key={a.key}>{a.label}: {a.selected?(a.assignedOwner||'Owner required'):'Not selected'}</li>)}</ul>
    <p>{component.attachmentIds.length} component network attachments. Map attachments in Networking and IP plan. Consumer qualification and execution remain separate.</p>
  </section>
}
