import type {Project} from './project'
import {SUPPORT_CATALOG,supportPlan,type SupportStatus} from './supportCatalog'

export const supportLabels:Record<SupportStatus,string>={supported:'Documented vendor baseline',preview:'Preview baseline',unknown:'Unknown / review needed',unavailable:'Unavailable for the stated use'}
export function SupportPanel({project}:{project:Project}){
  const plan=supportPlan(project)
  return <section className="panel"><h2>Product and architecture support references</h2><p>Catalog {SUPPORT_CATALOG.version} · reviewed {SUPPORT_CATALOG.reviewedAt}. {plan.meaning}</p>
    {!plan.rows.length&&<p>Select a management component or SDN design to see applicable reference baselines.</p>}
    {plan.rows.map((row,index)=><details className="resource" key={`${row.targetId}-${row.entry.id}-${index}`}><summary><strong>{row.targetName}: {row.entry.topic}</strong><span>{supportLabels[row.entry.status]} · {row.entry.baseline}</span></summary><div className="resource-body"><p>{row.entry.summary}</p><ul>{row.entry.conditions.map(condition=><li key={condition}>{condition}</li>)}</ul>{row.entry.sources.map((source,i)=><p key={source}><a href={source} target="_blank" rel="noreferrer">{row.entry.basis==='vendor'?'Vendor reference':'Related reference'} {i+1} ↗</a></p>)}</div></details>)}
    <p>Record exact OS, role, product build, hosting and HA evidence with the component. An accepted preview remains a preview. Execution consumers need their own qualification.</p>
  </section>
}
