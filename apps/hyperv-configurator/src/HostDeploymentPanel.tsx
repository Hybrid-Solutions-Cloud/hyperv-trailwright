import type {Project} from './project'
import {hostDeploymentPlan} from './hostDeploymentPlan'
import {collections} from './catalog'
export function HostDeploymentPanel({project}:{project:Project}){
  const plan=hostDeploymentPlan(project)
  if(!plan.hosts.length)return null
  const label=(key:string,value:unknown)=>collections.find(c=>c.key==='hosts')?.fields.find(f=>f.key===key)?.options?.[String(value)]||'Not specified'
  return <section className="panel" aria-label="Host deployment review"><h2>Host deployment review</h2><p>{plan.meaning}</p><p>Hosts: {plan.hosts.length}. Replacement scopes: {plan.hosts.filter(h=>h.replacement).length}. Findings: {plan.findings.length}.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Per-host deployment actions"><table><thead><tr><th scope="col">Host</th><th scope="col">Observed state</th><th scope="col">OS action / owner</th><th scope="col">Hyper-V role / owner</th><th scope="col">Membership / owner</th></tr></thead><tbody>{plan.hosts.map(h=><tr key={h.hostId}><th scope="row">{h.name}</th><td>{label('currentState',h.inputs.currentState)}</td><td>{label('osAction',h.inputs.osAction)} / {label('osOwner',h.inputs.osOwner)}</td><td>{label('hostRoleAction',h.inputs.hostRoleAction)} / {label('hostRoleOwner',h.inputs.hostRoleOwner)}</td><td>{label('clusterAction',h.inputs.clusterAction)} / {label('clusterJoinOwner',h.inputs.clusterJoinOwner)}</td></tr>)}</tbody></table></div></section>
}
