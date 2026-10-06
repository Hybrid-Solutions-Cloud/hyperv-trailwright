import type {Project} from './project'
import {validate,type Finding} from './validation'
import {designProgress} from './review'
import {stagePlan} from './stagePlan'
import {sdnEvidenceAssessment} from './sdnEvidence'

export function readinessStates(input:{errors:number;reviews:number;missingInputs:number;stageBlocked:number;running:number;failed:number;reportedPassed:number;stageCount:number;sdnObservationStatus:string}){
  const designComplete=input.errors===0&&input.reviews===0&&input.missingInputs===0
  const reported=input.reportedPassed>0||input.sdnObservationStatus==='passed-observation'
  const observationNeedsReview=['stale','partial','ambiguous','design-unresolved'].includes(input.sdnObservationStatus)
  const runtimeState=input.failed>0||input.sdnObservationStatus==='failed'?'review-failure':input.stageBlocked>0||observationNeedsReview?'review-required':input.running>0?'in-progress':reported?'operator-reported':'unknown'
  return {designState:designComplete?'design-complete':'draft',runtimeState,automationReady:false,deploymentVerified:false,
    allStagesReportedPassed:input.stageCount>0&&input.reportedPassed===input.stageCount&&input.stageBlocked===0}
}

/** Design completeness is independent of the customer's implementation tools. */
export function projectReadiness(project:Project,findings:Finding[]=validate(project),assessedAt=new Date().toISOString()){
  const sections=designProgress(project,findings),plan=stagePlan(project),sdnEvidence=sdnEvidenceAssessment(project,assessedAt)
  const counts={errors:findings.filter(f=>f.severity==='error').length,reviews:findings.filter(f=>f.severity==='warning').length,missingInputs:sections.reduce((n,s)=>n+s.required-s.answered,0),
    stageBlocked:plan.blockedStageIds.length,running:plan.stages.filter(s=>s.disposition==='in-progress').length,failed:plan.stages.filter(s=>s.reportedState==='failed').length,
    reportedPassed:plan.stages.filter(s=>s.disposition==='reported-passed').length,stageCount:plan.stages.length}
  const state=readinessStates({...counts,sdnObservationStatus:sdnEvidence.status})
  return {kind:'hyperv-project-readiness',schemaVersion:2,projectId:project.id,projectRevision:project.revision,...state,counts,sections,
    assessedOn:assessedAt.slice(0,10),sdnEvidence:{status:sdnEvidence.status},evidenceBasis:'Configuration rules and user-entered observations. SDN observation freshness is assessed at review time. Implementation is managed outside the configurator.',
    nextActions:[...(counts.errors||counts.missingInputs?['Resolve required inputs and design errors.']:[]),...(counts.reviews?['Resolve outstanding support and scope reviews.']:[]),...(state.designState==='design-complete'?['Export the reviewed configuration for your existing implementation process.']:[])]}
}

export function readinessMarkdown(project:Project){
  const r=projectReadiness(project)
  return ['## Project readiness','',`Design: ${r.designState}. Runtime: ${r.runtimeState}. Deployment verified: no.`,'',
    `${r.counts.errors} design errors; ${r.counts.reviews} reviews; ${r.counts.missingInputs} missing required inputs.`,r.evidenceBasis,'',...r.nextActions.map(a=>`- ${a}`),''].join('\n')
}
