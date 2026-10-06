import {useId} from 'react'
import {products,hosts,lifecycles} from './project'
import type {OmittedComponent,OmissionProject} from './componentOmissions'

function OmissionCard({row,change,restore}:{row:OmittedComponent;change:(patch:Partial<Pick<OmittedComponent,'reason'|'reviewOwner'>>)=>void;restore:()=>void}){
  const id=useId(),c=row.component
  return <details className="resource" data-record-id={c.id} open><summary><strong>{c.name||products[c.product]}</strong><span>Omitted from active design</span></summary><div className="resource-body">
    <p>{products[c.product]} · {hosts[c.hosting]} · previous lifecycle: {lifecycles[c.lifecycle]} · version {c.version||'not supplied'}.</p>
    <p>Retained capacity: {c.vCpu} vCPU, {c.memoryGiB} GiB memory, {c.diskGiB} GiB disk. These values are excluded from active totals.</p>
    <p>Omitted at {row.omittedAt}. The complete configuration remains in the saved project. Restore it to edit its configuration; restoration does not deploy anything.</p>
    <div className="fields">
      <label className="field wide" data-field-key="omissionReason" htmlFor={id+'-reason'}><span>Omission reason</span><textarea id={id+'-reason'} aria-label="Omission reason" rows={3} maxLength={16000} value={row.reason} onChange={e=>change({reason:e.target.value})}/></label>
      <label className="field" data-field-key="omissionOwner" htmlFor={id+'-owner'}><span>Omission review owner</span><input id={id+'-owner'} aria-label="Omission review owner" maxLength={16000} value={row.reviewOwner} onChange={e=>change({reviewOwner:e.target.value})}/></label>
    </div>
    <button onClick={restore}>Restore to active design</button>
  </div></details>
}
export function OmittedComponentsPanel({project,change,restore}:{project:OmissionProject;change:(project:OmissionProject)=>void;restore:(id:string)=>void}){
  return <section className="panel"><h2>Omitted components</h2><p>Retain excluded instances and their rationale. Active dependencies and assignments that still reference them need an explicit decision.</p>
    {!project.omittedComponents.length&&<p>No components omitted. Use Omit from design on an active component to retain it here.</p>}
    {project.omittedComponents.map(row=><OmissionCard key={row.component.id} row={row} restore={()=>restore(row.component.id)} change={patch=>change({...project,omittedComponents:project.omittedComponents.map(other=>other.component.id===row.component.id?{...other,...patch}:other)})}/>)}
  </section>
}
