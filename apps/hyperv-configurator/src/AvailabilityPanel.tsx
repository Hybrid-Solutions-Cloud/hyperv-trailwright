import type {Project} from './project'
import {availabilityPlan} from './availabilityPlan'
export function AvailabilityPanel({project}:{project:Project}){
  const plan=availabilityPlan(project)
  if(!plan.groups.length)return null
  return <section className="panel" aria-label="Availability assessment"><h2>Availability assessment</h2><p>{plan.meaning}</p>
    {plan.groups.map(g=><article key={g.groupId}><h3>{g.name}</h3><p>{g.members.length} declared members / observers. {g.findings.length} role, voting or recovery findings.</p>
      {!!g.details.placement.sharedHosts.length&&<p>Shared physical hosts: {g.details.placement.sharedHosts.length}. Their member losses are correlated.</p>}
      {g.details.sql.status!=='not-applicable'&&<p>SQL availability: {g.details.sql.status}. {g.details.sql.databaseCount} {g.details.sql.databaseCount===1?'database':'databases'}; {g.details.sql.replicaCount} members; {g.details.sql.automaticCandidates} synchronous automatic candidates. Runtime synchronization is not established.</p>}
      {!!g.members.length&&<div className="table-scroll" tabIndex={0} role="region" aria-label={g.name+' member placement'}><table><thead><tr><th scope="col">Member</th><th scope="col">Failure domain</th><th scope="col">Host or placement policy</th><th scope="col">Basis</th></tr></thead><tbody>{g.members.map((m,i)=>{
        const inputs=g.details.placement.inputs.find(p=>p.componentId===m.componentId)?.values
        const fixed=inputs&&['pinned','physical'].includes(String(inputs.placementMode))
        const host=project.design.hosts.find(h=>h.id===inputs?.physicalHost)
        const identity=fixed?(host?.values.name||inputs?.nativeHostId):(inputs?.placementPolicy)
        return <tr key={m.componentId+':'+i}><th scope="row">{m.name}</th><td>{m.failureDomain||'Unspecified'}</td><td>{String(identity||'Unspecified')}{fixed&&inputs?.hostScope?<small> — {String(inputs.hostScope)}</small>:null}</td><td>{inputs?.placementBasis==='current'?'Current observed':inputs?.placementBasis==='desired'?'Desired':'Unspecified'}</td></tr>
      })}</tbody></table></div>}
      {g.voting.status!=='not-applicable'&&<p>Pool voting: {g.voting.status}. {g.voting.totalVotes===null?'Complete the voting inputs before calculating.':`${g.voting.totalVotes} votes; ${g.voting.requiredVotes} required. Worst remaining votes: ${g.voting.worstRemainingVotes}; worst remaining workload members: ${g.voting.worstRemainingWorkers}.`}</p>}
      {g.voting.assumptions.map(a=><p key={a}>{a}</p>)}
    </article>)}
  </section>
}
