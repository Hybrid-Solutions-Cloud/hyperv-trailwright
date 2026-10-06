import type {Project} from './project'
import type {DesignRecord} from './catalog'
import type {Finding} from './validation'
import {validTime} from './discoveryContract'
import {backupDeclined,monitoringDeclined} from './componentDecisions'
const s=(r:DesignRecord,k:string)=>String(r.values[k]??'').trim()
const sorted=(p:Project,k:string)=>[...p.design[k]].sort((a,b)=>a.id.localeCompare(b.id))
export function operationsPlan(project:Project,now=Date.now()){
 const findings:Finding[]=[]
 const add=(code:string,row:DesignRecord,fieldKey:string,message:string,severity:Finding['severity']='error',section='operations')=>findings.push({code,section,recordId:row.id,fieldKey,message,severity})
 const policies=sorted(project,'operations'),targets=sorted(project,'operationsTargets'),tests=sorted(project,'recoveryTests'),thresholds=sorted(project,'capacityAlerts'),security=sorted(project,'securityPolicies')
 const patchScope=(target:DesignRecord)=>{
  const policy=policies.find(p=>p.id===target.values.plan),id=s(target,'resource')
  return policy&&['cauSelf','cauRemote'].includes(s(policy,'patchMethod'))&&id===s(policy,'patchCluster')?[id,...project.design.hosts.filter(h=>h.values.cluster===id).map(h=>h.id)]:[id]
 }
 // A declined backup or monitoring component hides its questions; its retained answers raise no findings.
 const inScope=(area:string)=>!(area==='backup'&&backupDeclined(project)||area==='monitoring'&&monitoringDeclined(project))
 const required=(row:DesignRecord,keys:string[],message:string,section='operations')=>{for(const key of keys)if(!s(row,key))add('OPERATIONS_REVIEW',row,key,message,'warning',section)}
 for(const target of targets){
  const areas=['monitoring','patching','backup','security'].filter(k=>target.values[k]&&inScope(k))
  if(!areas.length)add('OPERATIONS_AREA',target,'monitoring','Select the responsibilities assigned to this resource.')
  for(const area of areas)if(targets.some(t=>t.id!==target.id&&t.values[area]&&(area==='patching'?patchScope(t).some(id=>patchScope(target).includes(id)):s(t,'resource')===s(target,'resource'))))add('OPERATIONS_OWNER_CONFLICT',target,'plan',`This resource has multiple ${area} policy assignments; retain one explicit owner.`)
 }
 for(const plan of policies){
  const assigned=targets.filter(t=>s(t,'plan')===plan.id),active=(area:string)=>inScope(area)&&assigned.some(t=>t.values[area]),v=plan.values
  if(!assigned.length)add('OPERATIONS_TARGETS',plan,'scope','Link the exact resources covered by this operations plan.','warning')
  if(active('monitoring')){
   required(plan,['monitoringTool','alertOwner','alertRoute','discoveryAcceptance'],'Record monitoring ownership, discovery and alert acceptance.')
   if(s(plan,'scomComponent')&&project.components.find(c=>c.id===v.scomComponent)?.product!=='scom')add('OPERATIONS_SCOM_ROLE',plan,'scomComponent','The monitoring component must be an active SCOM service.')
  }
  if(active('patching')){
   required(plan,['patchMethod','patchOwner','patchToolVersion','changeWindow','maintenanceAcceptance','patchRollback'],'Record patch ownership, schedule, drain/maintenance acceptance and failed-update recovery.')
   if(['cauSelf','cauRemote'].includes(s(plan,'patchMethod'))){
    const cluster=project.design.clusters.find(c=>c.id===v.patchCluster)
    if(!cluster||cluster.values.topology==='standalone')add('OPERATIONS_CAU_CLUSTER',plan,'patchCluster','CAU requires an explicit failover cluster target.')
    required(plan,['patchPlugin','patchPrerequisites'],'Record the CAU plug-in, exact version and feature/identity/remoting prerequisites.')
    for(const t of assigned.filter(t=>t.values.patching)){const host=project.design.hosts.find(h=>h.id===t.values.resource);if(t.values.resource!==v.patchCluster&&(!host||host.values.cluster!==v.patchCluster))add('OPERATIONS_CAU_SCOPE',t,'resource','A CAU policy can target its cluster and member hosts only.')}
    if(v.patchMethod==='cauRemote'){
     if(!s(plan,'updateCoordinator'))add('OPERATIONS_CAU_COORDINATOR',plan,'updateCoordinator','Select the remote update coordinator.','warning')
     const host=project.design.hosts.find(h=>h.id===v.updateCoordinator)
     const component=project.components.find(c=>c.id===v.updateCoordinator)
     if(s(plan,'updateCoordinator')&&!host&&!component)add('OPERATIONS_CAU_COORDINATOR_TYPE',plan,'updateCoordinator','The update coordinator must be an inventoried server or VM component.')
     if(host?.values.cluster===v.patchCluster||v.updateCoordinator===v.patchCluster)add('OPERATIONS_CAU_COORDINATOR_MEMBER',plan,'updateCoordinator','The remote CAU update coordinator must not be a member of the cluster being updated.')
    }
   }
  }
  if(active('backup')){
   if(v.backupMode==='none')required(plan,['backupException'],'An explicit no-backup decision needs scope, risk ownership and approval.')
   else{
    required(plan,['backupMode','backupOwner','backupProvider','backupRepository','backupConsistency','backupProtection'],'Record the backup provider, scope, repository protection and responsible owner.')
    if(Number(v.backupIntervalMinutes)<=0)add('OPERATIONS_BACKUP_INTERVAL',plan,'backupIntervalMinutes','Record a positive backup interval; a schedule is not measured recovery evidence.','warning')
    if(Number(v.backupRetentionDays)<=0)add('OPERATIONS_BACKUP_RETENTION',plan,'backupRetentionDays','Record the backup retention period.','warning')
   }
   if(v.objectiveState==='defined'){
    required(plan,['objectiveEvidence','restore','recoveryDependencies','recoveryAcceptance'],'Record agreed objectives and the dependency, application and data recovery acceptance.')
    if(Number(v.backupIntervalMinutes)>Number(v.rpoMinutes))add('OPERATIONS_RPO_SCHEDULE',plan,'backupIntervalMinutes','The backup interval exceeds the RPO; document replication/log protection or revise the recovery design.','warning')
   }else if(v.objectiveState!=='notRequired')add('OPERATIONS_OBJECTIVES',plan,'objectiveState','Select whether recovery objectives are explicitly defined; default zero values do not imply zero-loss or instant recovery.','warning')
  }
  if(active('security')&&!s(plan,'securityPolicy'))add('OPERATIONS_SECURITY_POLICY',plan,'securityPolicy','Link the security policy applied to these resources.','warning')
 }
 const recovery=(backupDeclined(project)?[]:tests).map(test=>{
  const target=targets.find(t=>t.id===test.values.assignment),plan=policies.find(p=>p.id===target?.values.plan),observed=['passed','failed','partial'].includes(s(test,'state')),defined=plan?.values.objectiveState==='defined'
  if(target&&!target.values.backup)add('OPERATIONS_TEST_SCOPE',test,'assignment','A recovery test must reference an assignment with a backup/recovery responsibility.')
  const validObservation=validTime(test.values.observedAt)&&Date.parse(String(test.values.observedAt))<=now
  const scopeCurrent=!!target&&!!plan&&test.values.testedResource===target.values.resource&&test.values.testedPlan===plan.id&&test.values.testedBackupProvider===plan.values.backupProvider&&test.values.testedBackupRepository===plan.values.backupRepository
  if(observed&&!scopeCurrent)add('OPERATIONS_TEST_IDENTITY',test,'testedResource','The recorded test resource, policy, backup provider and repository must match the current assignment before comparing objectives.')
  if(observed){
   if(!validObservation)add('OPERATIONS_TEST_TIME',test,'observedAt','Reported recovery observations require a valid, nonfuture UTC timestamp.')
   required(test,['sourceVersion','evidence','acceptance'],'Record the recovery consumer/version, evidence and application/data acceptance.')
  }
  const metricsValid=test.values.measurementState==='confirmed'&&['durationMinutes','dataAgeMinutes'].every(k=>typeof test.values[k]==='number'&&Number.isFinite(test.values[k])&&Number(test.values[k])>=0)
  if(observed&&!metricsValid)add('OPERATIONS_MEASURED_METRICS',test,'measurementState','Explicitly confirm measured recovery duration and recovered data age; default zero values are not evidence.','warning')
  const complete=observed&&test.values.state==='passed'&&validObservation&&scopeCurrent&&metricsValid&&['sourceVersion','evidence','acceptance'].every(k=>!!s(test,k))
  const rtoMet=complete&&defined?Number(test.values.durationMinutes)<=Number(plan!.values.rtoMinutes):null,rpoMet=complete&&defined?Number(test.values.dataAgeMinutes)<=Number(plan!.values.rpoMinutes):null
  if(rtoMet===false)add('OPERATIONS_RTO_MISSED',test,'durationMinutes','Measured recovery duration exceeds the agreed RTO.')
  if(rpoMet===false)add('OPERATIONS_RPO_MISSED',test,'dataAgeMinutes','Measured recovered data age exceeds the agreed RPO.')
  if(['failed','partial'].includes(s(test,'state')))required(test,['failure'],'Record test limitations and corrective action.')
  return {id:test.id,assignmentId:s(test,'assignment'),resourceId:target?s(target,'resource'):'',state:s(test,'state'),evidenceComplete:complete,rtoMet,rpoMet,runtimeQualified:false,inputs:test.values}
 })
 for(const threshold of monitoringDeclined(project)?[]:thresholds){
  const v=threshold.values,target=targets.find(t=>t.id===v.assignment)
  if(target&&!target.values.monitoring)add('OPERATIONS_THRESHOLD_SCOPE',threshold,'assignment','Capacity thresholds require a monitoring assignment.')
  if(v.direction==='high'&&Number(v.warning)>=Number(v.critical)||v.direction==='low'&&Number(v.warning)<=Number(v.critical))add('OPERATIONS_THRESHOLD_ORDER',threshold,'critical','Warning and critical thresholds must follow the selected direction.')
  if(v.unit==='percent'&&(Number(v.warning)>100||Number(v.critical)>100))add('OPERATIONS_THRESHOLD_PERCENT',threshold,'critical','Percentage thresholds must be between 0 and 100.')
  if(['cpu','memory','storage'].includes(s(threshold,'metric'))&&v.unit!=='percent'||v.metric==='latency'&&v.unit!=='milliseconds'||v.metric==='freeSpace'&&!['percent','gib'].includes(s(threshold,'unit')))add('OPERATIONS_THRESHOLD_UNIT',threshold,'unit','Choose units appropriate to the selected metric.')
  required(threshold,['counter','acceptance'],'Record the actual monitor/counter identity and alert acceptance.')
 }
 for(const policy of security){
  required(policy,['baseline','privilegedIdentity','roles','winrm','ssh','defender','endpointProtection','trust','audit','acceptance'],'Record security control ownership and acceptance.','identity')
  if(policy.values.winrm==='https'&&!s(policy,'trustIdentity'))add('OPERATIONS_HTTPS_TRUST',policy,'trustIdentity','WinRM HTTPS requires a reviewed certificate/trust identity.','warning','identity')
  for(const [field,kinds]of [['trustIdentity',['pki']],['runnerIdentity',['runner','service','gmsa']],['privilegedIdentity',['service','gmsa','runner']]] as const){
   const identity=project.design.identities.find(i=>i.id===policy.values[field])
   if(identity&&!(kinds as readonly string[]).includes(s(identity,'kind')))add('OPERATIONS_SECURITY_IDENTITY',policy,field,'Select an identity with the role required by this security control.','error','identity')
  }
 }
 return {kind:'hyperv-operations-plan',version:'0.1.0',projectId:project.id,revision:project.revision,reviewedAt:'2026-09-11',runtimeQualified:false,policies,targets,recovery,thresholds,security,findings,sources:['https://learn.microsoft.com/en-us/windows-server/failover-clustering/cluster-aware-updating','https://learn.microsoft.com/en-us/windows-server/failover-clustering/cluster-aware-updating-requirements','https://learn.microsoft.com/en-us/system-center/scom/manage-overview-management-pack?view=sc-om-2025']}
}
export function operationsRecoverySchedule(project:Project){return operationsPlan(project).recovery.map(r=>({Test:String(r.inputs.name),TestId:r.id,AssignmentId:r.assignmentId,ResourceId:r.resourceId,State:r.state,ObservedAt:String(r.inputs.observedAt),DurationMinutes:r.inputs.durationMinutes,RecoveredDataAgeMinutes:r.inputs.dataAgeMinutes,EvidenceComplete:r.evidenceComplete?'Yes':'No',RtoMet:r.rtoMet===null?'Unknown':r.rtoMet?'Yes':'No',RpoMet:r.rpoMet===null?'Unknown':r.rpoMet?'Yes':'No',RuntimeQualified:'No'}))}
