import type {Project} from './project'
import {prerequisitePlan} from './prerequisitePlan'
export function PrerequisitePanel({project}:{project:Project}){
  const plan=prerequisitePlan(project)
  if(!plan.identities.length&&!plan.media.length&&!plan.arc.length)return null
  const rows=[...plan.identities.map(r=>({id:r.recordId,name:r.name,kind:'Identity',state:r.status})),...plan.media.map(r=>({id:r.recordId,name:r.name,kind:'Artifact',state:r.status})),...plan.arc.map(r=>({id:r.componentId,name:r.name,kind:'Arc integration',state:r.status}))]
  return <section className="panel" aria-label="Prerequisite review"><h2>Prerequisite review</h2><p>{plan.meaning}</p><p>{plan.identityBindings.length} identity assignments; {plan.mediaBindings.length} artifact assignments. {plan.findings.length} findings need review.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Prerequisite evidence summary"><table><thead><tr><th scope="col">Prerequisite</th><th scope="col">Type</th><th scope="col">Evidence state</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th scope="row">{String(r.name||r.id)}</th><td>{r.kind}</td><td>{r.state}</td></tr>)}</tbody></table></div></section>
}
