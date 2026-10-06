import type {Project} from './project'
import {operationsPlan} from './operationsPlan'
export function OperationsPanel({project}:{project:Project}){
 const plan=operationsPlan(project)
 const result=(value:boolean|null)=>value===null?'Not established':value?'Met in this test':'Missed in this test'
 return <section className="panel" aria-label="Operations and recovery review"><h2>Operations and recovery review</h2><p>Assign exact resources to monitoring, patch, backup and security policies. Recovery results below describe individual operator-reported tests, not current service health or authenticated runtime qualification.</p>
 {!plan.targets.length&&<p>Add resource assignments to connect each operations plan to its managed scope.</p>}
 {!!plan.recovery.length&&<div className="table-scroll" tabIndex={0} role="region" aria-label="Recovery objective results"><table><caption>Recovery objective results</caption><thead><tr><th scope="col">Test</th><th scope="col">Observation</th><th scope="col">Reported state</th><th scope="col">RTO</th><th scope="col">RPO</th></tr></thead><tbody>{plan.recovery.map(r=><tr key={r.id}><th scope="row">{String(r.inputs.name)}</th><td>{String(r.inputs.observedAt)||'Not supplied'}</td><td>{r.state||'Not selected'}</td><td>{result(r.rtoMet)}</td><td>{result(r.rpoMet)}</td></tr>)}</tbody></table><p>Zero objectives and measurements count only when explicitly confirmed. Planned, partial or incomplete tests cannot prove an objective was met.</p></div>}
 {!!plan.findings.length&&<details><summary>{plan.findings.length} operations decisions to resolve</summary><ul>{plan.findings.map((f,i)=><li key={i}>{f.severity==='error'?'Required':'Review'}: {f.message}</li>)}</ul><p>Use Review and exports to open the affected field.</p></details>}
 </section>
}
