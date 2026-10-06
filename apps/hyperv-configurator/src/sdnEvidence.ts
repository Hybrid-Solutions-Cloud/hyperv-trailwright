import {sha256} from 'js-sha256'
import {collections,hostingFields,productFields,visibleField,type Answers,type Field} from './catalog'
import {activeSdnFields,activeSdnDetails} from './sdnActiveFields'
import {sdnCollectionKeys} from './sdnFields'
import {sdnPlan} from './sdnPlan'
import {serializeProject,type Project} from './project'
import {canonical,SDN_EVIDENCE_LIMIT,validateSdnEvidence,type SdnEvidence,type SdnEvidenceEntry} from './sdnEvidenceContract'

export const SDN_EVIDENCE_AGE_DAYS=7
const activeAnswers=(values:Answers,fields:Field[])=>Object.fromEntries(fields.filter(f=>visibleField(f,values)).map(f=>[f.key,values[f.key]]))
/** Evidence scope is independent of revision, timestamps, history and unrelated project sections. */
export function sdnEvidenceScope(project:Project){
 if(project.sdn.scope==='none')return {contractVersion:2,projectId:project.id,active:false,sdn:null,resources:[]}
 const catalog=collections.flatMap(c=>project.design[c.key].map(r=>({id:r.id,collection:c.key,section:c.section,values:activeAnswers(r.values,c.fields),fields:c.fields})))
 const components=project.components.map(c=>({id:c.id,collection:'components',section:'products',values:{...c,hostingDetails:activeAnswers(c.hostingDetails,hostingFields),productDetails:activeAnswers(c.productDetails,productFields[c.product])},fields:[] as Field[]}))
 const entries=[...catalog,...components],selected=new Set(catalog.filter(r=>sdnCollectionKeys.includes(r.collection)).map(r=>r.id))
 const refs=(fields:Field[],values:Answers)=>fields.filter(f=>f.collection&&visibleField(f,values)&&values[f.key]).map(f=>String(values[f.key]))
 refs(activeSdnFields(project.sdn),project.sdn.details).forEach(id=>selected.add(id))
 let changed=true
 while(changed){changed=false;const add=(id:string)=>{if(id&&!selected.has(id)){selected.add(id);changed=true}}
  for(const row of entries){
   if(selected.has(row.id)){
    if(row.collection==='components'){const c=project.components.find(c=>c.id===row.id)!;[...refs(hostingFields,c.hostingDetails),...refs(productFields[c.product],c.productDetails)].forEach(add)}
    else refs(row.fields,row.values as Answers).forEach(add)
   }else if(['topology','network','storage','identity','hosting','sdn'].includes(row.section)&&row.fields.some(f=>['host','cluster','system','hostSwitch','resource'].includes(f.key)&&f.collection&&visibleField(f,row.values as Answers)&&selected.has(String((row.values as Answers)[f.key]))))add(row.id)
  }
 }
 return {contractVersion:2,projectId:project.id,active:true,sdn:{...project.sdn,details:activeSdnDetails(project.sdn)},resources:entries.filter(r=>selected.has(r.id)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(({id,collection,values})=>({id,collection,values}))}
}
export function sdnAcceptanceRequest(project:Project){
 const scope=sdnEvidenceScope(project),plan=sdnPlan(project)
 const groups:Record<string,string[]>={
  'east-west':['sdnHostBindings','tenantServices','sdnAclRules','sdnBackendMembers'],
  isolation:['tenantServices','sdnAclRules','sdnBackendMembers'],
  'north-south':['sdnGatewayPools','sdnGatewayMembers','sdnConnections','sdnRoutes'],
  'vip-nat':['sdnFrontends','sdnBackendPools','sdnBackendMembers','sdnProbes','sdnTrafficRules'],
  bgp:['bgpPeers','sdnConnections','sdnRoutes'],
  failover:['sdnResources','sdnGatewayPools','sdnGatewayMembers','tenantServices'],
 }
 const required=plan.acceptance.map(a=>{let targetIds=scope.resources.filter(r=>groups[a.id]?.includes(r.collection)).map(r=>r.id);if(!targetIds.length)targetIds=scope.resources.filter(r=>sdnCollectionKeys.includes(r.collection)).map(r=>r.id);return {...a,targetIds}})
 return {kind:'hyperv-sdn-acceptance-request',schemaVersion:1,projectId:project.id,scopeHash:sha256(canonical(scope)),scope,required,maximumAgeDays:SDN_EVIDENCE_AGE_DAYS,executionAllowed:false,runtimeQualified:false}
}
export function sdnEvidenceTemplate(project:Project):SdnEvidence{
 const request=sdnAcceptanceRequest(project)
 return {kind:'hyperv-sdn-evidence',schemaVersion:1,id:'',projectId:project.id,scopeHash:request.scopeHash,observedAt:'',source:{operator:'',runner:'',version:'',endpoint:''},results:request.required.map((r,i)=>({id:`result-${i+1}`,scenario:r.id,targetIds:r.targetIds,status:'not-run',expected:r.description,observed:'',evidenceRef:''}))}
}
export function importSdnEvidence(project:Project,source:Uint8Array|string,fileName:string,now=new Date().toISOString()):Project{
 if(project.sdn.scope==='none')throw new Error('Select an active SDN scope before importing evidence.')
 const bytes=typeof source==='string'?new TextEncoder().encode(source):Uint8Array.from(source)
 if(bytes.length>SDN_EVIDENCE_LIMIT)throw new Error('SDN evidence exceeds 512 KiB.')
 let original:string,evidence:unknown
 try{original=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);evidence=JSON.parse(original.replace(/^\uFEFF/,''))}catch{throw new Error('Choose valid UTF-8 SDN evidence JSON.')}
 validateSdnEvidence(evidence)
 if(evidence.projectId!==project.id)throw new Error('SDN evidence belongs to another project.')
 const request=sdnAcceptanceRequest(project)
 if(evidence.scopeHash!==request.scopeHash)throw new Error('SDN design changed since this evidence request; retain the original project or collect results against a fresh request.')
 if(Date.parse(evidence.observedAt)>Date.parse(now))throw new Error('SDN observation time is in the future.')
 for(const result of evidence.results){const scenario=request.required.find(r=>r.id===result.scenario);if(!scenario||result.targetIds.some(id=>!scenario.targetIds.includes(id)))throw new Error('SDN result contains an unexpected scenario or target for this request.')}
 const entry:SdnEvidenceEntry={evidence,original,sha256:sha256(bytes),fileName,importedAt:now},next=structuredClone(project)
 next.sdnEvidence.entries.push(entry);next.updatedAt=now;next.revision=project.revision+1
 serializeProject(next)
 return next
}
export function sdnEvidenceAssessment(project:Project,now=new Date().toISOString()){
 const request=sdnAcceptanceRequest(project),entries=[...project.sdnEvidence.entries].sort((a,b)=>Date.parse(b.evidence.observedAt)-Date.parse(a.evidence.observedAt)||a.evidence.id.localeCompare(b.evidence.id))
 const matching=entries.filter(e=>e.evidence.scopeHash===request.scopeHash),latest=matching[0],designReady=sdnPlan(project).fabricContractComplete
 let status='missing'
 if(!request.scope.active)status='inactive'
 else if(!latest&&entries.length)status='stale'
 else if(latest){
  if(matching[1]?.evidence.observedAt===latest.evidence.observedAt)status='ambiguous'
  else if(Date.parse(now)-Date.parse(latest.evidence.observedAt)>SDN_EVIDENCE_AGE_DAYS*86400000||Date.parse(latest.evidence.observedAt)>Date.parse(now))status='stale'
  else if(latest.evidence.results.some(r=>r.status==='failed'))status='failed'
  else status='partial'
 }
 const scenarios=request.required.map(s=>{
  const results=latest?.evidence.results.filter(r=>r.scenario===s.id)??[],covered=new Set(results.filter(r=>r.status==='passed').flatMap(r=>r.targetIds)),missingTargets=s.targetIds.filter(id=>!covered.has(id))
  return {id:s.id,description:s.description,targetIds:s.targetIds,status:['stale','ambiguous'].includes(status)?status:results.some(r=>r.status==='failed')?'failed':results.some(r=>r.status==='not-run')||missingTargets.length||!s.targetIds.length?'incomplete':'passed-observation',missingTargets,resultIds:results.map(r=>r.id)}
 })
 if(status==='partial'&&scenarios.length&&scenarios.every(s=>s.status==='passed-observation'))status=designReady?'passed-observation':'design-unresolved'
 return {kind:'hyperv-sdn-acceptance-review',contractVersion:1,projectId:project.id,scopeHash:request.scopeHash,status,designReady,latestId:latest?.evidence.id??null,scenarios,history:entries.map(e=>({id:e.evidence.id,fileName:e.fileName,sha256:e.sha256,observedAt:e.evidence.observedAt,importedAt:e.importedAt,scopeMatches:e.evidence.scopeHash===request.scopeHash,source:e.evidence.source})),executionAllowed:false,runtimeQualified:false}
}
