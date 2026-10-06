import {useRef,useState} from 'react'
import type {Project} from './project'
import {download} from './exports'
import {sdnAcceptanceRequest,sdnEvidenceTemplate,sdnEvidenceAssessment,importSdnEvidence} from './sdnEvidence'
import {SDN_EVIDENCE_LIMIT} from './sdnEvidenceContract'

export function SdnEvidencePanel({project,change}:{project:Project;change:(p:Project)=>void}){
 const input=useRef<HTMLInputElement>(null),latest=useRef(project),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 latest.current=project
 const review=sdnEvidenceAssessment(project)
 return <section aria-label="SDN acceptance evidence" className="panel">
  <h3>SDN acceptance evidence</h3><p>Review status: <strong>{review.status}</strong>. Imported results are unsigned operator observations. They do not qualify an installer or mark setup stages complete.</p>
  <p>Download a request and result template before testing. Record actual scoped observations externally, then import the completed result file. Changes to this SDN design or its resource dependencies make earlier results stale. Evidence expires after seven days.</p>
  <div className="actions"><button onClick={()=>download('sdn-acceptance-request.json',JSON.stringify(sdnAcceptanceRequest(project),null,2),'application/json')}>Download SDN acceptance request</button><button onClick={()=>download('sdn-result-template.json',JSON.stringify(sdnEvidenceTemplate(project),null,2),'application/json')}>Download SDN result template</button><button disabled={busy} onClick={()=>input.current?.click()}>Import SDN evidence</button></div>
  <input ref={input} aria-label="SDN evidence file" hidden type="file" accept=".json,application/json" onChange={e=>{
   const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true)
   void(async()=>{try{if(file.size>SDN_EVIDENCE_LIMIT)throw new Error('SDN evidence exceeds 512 KiB.');const bytes=new Uint8Array(await file.arrayBuffer());if(latest.current!==project)throw new Error('The draft changed during import; choose the file again.');change(importSdnEvidence(project,bytes,file.name));setMessage('SDN evidence imported. Infrastructure and setup-stage status are unchanged.')}catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}})()
  }}/>
  {message&&<p role="status">{message}</p>}
  <ul>{review.scenarios.map(s=><li key={s.id}>{s.id}: {s.status}; {s.missingTargets.length} targets without a passed observation.</li>)}</ul>
  {!!review.history.length&&<details><summary>SDN evidence provenance ({review.history.length})</summary>{review.history.map(e=><div key={e.id}><p>{e.id} · {e.fileName} · {e.observedAt} · {e.scopeMatches?'Current scope':'Different design scope'}</p><p>{e.source.operator} · {e.source.runner} {e.source.version}</p><p className="discovery-hash">Original file SHA-256: {e.sha256}</p></div>)}</details>}
 </section>
}
