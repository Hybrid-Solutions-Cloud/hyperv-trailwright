import type {Project} from './project'
import {sdnPlan} from './sdnPlan'
import {sdnServices} from './sdnServices'
export function SdnPanel({project}:{project:Project}){
 const plan=sdnPlan(project),services=sdnServices(project)
 return <section aria-label="SDN setup review"><h3>SDN setup review</h3><p>{plan.intentLabel}. Required roles: {plan.requiredRoles.join(', ')}. Use the configuration and implementation checklist with your existing deployment process.</p>
 <div className="table-scroll" tabIndex={0} role="region" aria-label="SDN capacity categories"><table><caption>SDN capacity categories</caption><thead><tr><th scope="col">Category</th><th scope="col">Records</th><th scope="col">CPU allowance</th><th scope="col">GiB RAM</th><th scope="col">GiB disk</th></tr></thead><tbody>{Object.entries(plan.capacity).map(([key,v])=><tr key={key}><th scope="row">{key==='controllerHostOverhead'?'Host controller overhead':key==='controllerVms'?'Controller VMs':'MUX and gateway VMs'}</th><td>{v.records}</td><td>{v.vCpu}</td><td>{v.memoryGiB}</td><td>{v.diskGiB}</td></tr>)}</tbody></table></div>
 <h4>Controller deployment mapping</h4><p>{plan.controller.release||'Release unanswered'} · {plan.controller.tool||'Tool unanswered'} {plan.controller.version}. {plan.controller.templateName||'Architecture-specific procedure review'}. {plan.controller.expectedVmCount===0?'Controller runs on the cluster hosts.':'Expected controller VMs: '+(plan.controller.expectedVmCount??'Unanswered')+'.'}</p>
 <h4>Ordered setup handoff</h4><ol>{plan.stages.map(r=><li key={r.id}><strong>{r.name}</strong> — {r.instruction} ({r.mode}; {r.status})</li>)}</ol>
 <h4>Tenant service details</h4><p>Define security rules, frontends, backend pools and members, probes, NAT rules, gateway pools, connections and routes below. Child objects inherit their tenant service lifecycle and native owner. Reuse a frontend record for multiple listener ports.</p>
 <p>{project.design.sdnAclRules.length} security rules · {project.design.sdnTrafficRules.length} traffic rules · {project.design.sdnConnections.length} gateway connections</p>
 {!!services.capacity.length&&<div className="table-scroll" tabIndex={0} role="region" aria-label="Gateway pool capacity"><table><caption>Gateway pool capacity</caption><thead><tr><th>Pool</th><th>Members / reserve</th><th>Available Mbps</th><th>Requested Mbps</th><th>Headroom Mbps</th></tr></thead><tbody>{services.capacity.map(r=><tr key={r.id}><th>{r.name}</th><td>{r.members} / {r.reserve}</td><td>{r.availableMbps??'Unknown'}</td><td>{r.requestedMbps??'Unknown'}</td><td>{r.headroomMbps??'Unknown'}</td></tr>)}</tbody></table></div>}
 <h4>Required acceptance scenarios</h4><ul>{plan.acceptance.map(r=><li key={r.id}>{r.id}: {r.description}</li>)}</ul>
 {!!plan.findings.length&&<details><summary>{plan.findings.length} SDN decisions to resolve</summary><ul>{plan.findings.map((f,i)=><li key={i}>{f.severity}: {f.message}</li>)}</ul></details>}
 </section>
}
