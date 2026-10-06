import {useId} from 'react'
import type {Project} from './project'
import {deploymentOwners,managementQuestions,managementDecisionLabels,managementAdvice,type DecisionAnswer,type ManagementPlan} from './managementAdvisor'

export function ManagementAdvisorPanel({project,change}:{project:Project;change:(project:Project)=>void}){
  const id=useId(),plan=project.managementPlan,advice=managementAdvice(project)
  const set=(next:ManagementPlan)=>change({...project,managementPlan:next})
  return <><section className="panel"><h2>Management decisions and constraints</h2><p>Complete the decisions relevant to this engagement. Unanswered choices remain distinct from No. The capability selections above remain part of the same design.</p><div className="fields">
    {Object.entries(managementQuestions).map(([key,label])=><label className="field" data-field-key={key} key={key}><span id={id+key}>{label}</span><select aria-labelledby={id+key} value={plan.answers[key as keyof typeof managementQuestions]} onChange={event=>set({...plan,answers:{...plan.answers,[key]:event.target.value as DecisionAnswer}})}><option value="">Unanswered</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}
    <label className="field" data-field-key="deploymentOwner"><span id={id+'deploymentOwner'}>Bare-metal OS deployment owner</span><select aria-labelledby={id+'deploymentOwner'} value={plan.deploymentOwner} onChange={event=>set({...plan,deploymentOwner:event.target.value as ManagementPlan['deploymentOwner']})}><option value="">Choose when OS deployment is required</option>{Object.entries(deploymentOwners).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {Object.entries(managementDecisionLabels).map(([key,label])=><label className="field wide" data-field-key={key} key={key}><span id={id+key}>{label}</span><textarea rows={3} maxLength={16000} aria-labelledby={id+key} value={plan[key as keyof typeof managementDecisionLabels]} onChange={event=>set({...plan,[key]:event.target.value})}/></label>)}
  </div></section><section className="panel"><h2>Management options and rationale</h2><p>{advice.meaning}</p><p>{advice.unanswered.length} additional decisions unanswered. Review owner: {plan.decisionOwner||'Not assigned'}.</p>
    {!advice.options.length&&<p>No management product is inferred from the current requirements. Select capabilities or document the existing management decision.</p>}
    {advice.options.map(option=><div key={option.id} className="notice"><h3>{option.name} · {option.status}</h3><ul>{option.rationale.map(text=><li key={text}>{text}</li>)}</ul>{option.sources.map((url,i)=><p key={url}><a href={url} target="_blank" rel="noreferrer">Capability reference {i+1} ↗</a></p>)}</div>)}
    {!!advice.reviews.length&&<><h3>Design reviews</h3><ul>{advice.reviews.map(text=><li key={text}>{text}</li>)}</ul></>}
    <h3>Licensing and commercial review</h3><ul>{advice.commercialReview.map(text=><li key={text}>{text}</li>)}</ul>
  </section></>
}
