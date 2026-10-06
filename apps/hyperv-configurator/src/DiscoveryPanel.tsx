import { useRef, useState } from 'react'
import type { Project } from './project'
import { driftRows, importDiscovery, reviewDrift, confirmDiscoveryMapping } from './discovery'

export function DiscoveryPanel({project,change}:{project:Project;change:(p:Project)=>void}) {
  const input=useRef<HTMLInputElement>(null), [message,setMessage]=useState(''), [reviewer,setReviewer]=useState(''), [reason,setReason]=useState(''), [busy,setBusy]=useState(false)
  const latest=useRef(project);latest.current=project
  const rows=driftRows(project)
  return <section className="panel discovery-panel">
    <h2>Discovery and drift review</h2>
    <p>Import a scoped inventory snapshot to compare observed values with this design. Source identity and timestamps are unsigned operator evidence. File hashes identify the imported bytes; they do not authenticate the collector.</p>
    <button disabled={busy} onClick={()=>input.current?.click()}>Import discovery snapshot</button>
    <input aria-label="Discovery snapshot file" ref={input} type="file" hidden accept=".json,application/json" onChange={e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return
      setBusy(true)
      void (async()=>{try{if(file.size>2*1024*1024)throw new Error('Discovery file exceeds 2 MiB.');const next=await importDiscovery(project,new Uint8Array(await file.arrayBuffer()),file.name);if(latest.current!==project)throw new Error('The design changed during import; import again against the current draft.');change(next);setMessage('Snapshot imported. Design values are unchanged until you adopt a reviewed field.')}catch(error){setMessage(String(error))}finally{setBusy(false)}})()
    }}/>
    {message&&<p role="status">{message}</p>}
    <p>{project.discovery.snapshots.length} snapshots · {rows.filter(r=>r.status==='drift').length} differing fields · {rows.filter(r=>r.status==='blocked').length} blocked observations</p>
    <p>Only reported fields are compared. Other fields remain unobserved.</p>
    {!rows.length&&<p>No observed inventory is recorded. Import a snapshot produced by your existing inventory process using the documented JSON format. The configurator does not collect infrastructure inventory.</p>}
    {!!rows.length&&<>
      <div className="fields"><label className="field"><span>Discovery reviewer</span><input value={reviewer} maxLength={256} onChange={e=>setReviewer(e.target.value)}/></label><label className="field"><span>Discovery review reason</span><input value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label></div>
      <p>Preserve keeps the design value. Adopt updates this design field only. Reconcile records a requested infrastructure review; no commands are generated or executed from that decision. Evidence older than seven days requires recollection.</p>
      {rows.map(row=><details className="resource" key={row.key} open={rows.length<=4||undefined}>
        <summary><strong>{row.name} · {row.field||'Collection status'}</strong><span>{row.status}</span></summary>
        <div className="resource-body">
          <p>Designed: <strong>{String(row.desired)||'Not specified'}</strong> · Observed: <strong>{String(row.observed)}</strong></p>
          <p>{row.provider} · {row.source} · {row.collectedAt}</p><p>External identity: {row.externalId}</p><p className="discovery-hash">Source SHA-256: {row.sha256}</p>
          {row.observationNote&&<p>{row.observationNote}</p>}
          {row.blockingReason&&<p className="notice error">{row.blockingReason}</p>}
          {!!row.priorIdentities.length&&<p>Previous mappings (provider, endpoint, resource type, external identity): {row.priorIdentities.join('; ')}</p>}
          {row.blockingReason.startsWith('Source or external identity changed')&&<button disabled={busy} onClick={()=>{try{change(confirmDiscoveryMapping(project,row.key,reviewer,reason));setMessage('Latest identity mapping confirmed for this design target. Review each observed value separately.')}catch(error){setMessage(String(error))}}}>Confirm latest identity mapping</button>}
          {row.review&&<p>Decision: {row.review.decision} · {row.review.reviewer} · {row.review.reviewedAt} · {row.reviewCurrent?'Current':'Stale; review again'}<br/>{row.review.reason}</p>}
          <div className="actions">{(['preserve','adopt','reconcile'] as const).map(decision=><button key={decision} disabled={busy||row.status==='blocked'||(decision==='adopt'&&!row.canAdopt)} onClick={()=>{try{change(reviewDrift(project,row.key,row.desired,decision,reviewer,reason));setMessage(decision==='adopt'?'Observed value adopted into the design. Infrastructure was not changed.':'Review decision recorded. Infrastructure was not changed.')}catch(error){setMessage(String(error))}}}>{decision==='adopt'?'Adopt observed value':decision==='preserve'?'Preserve design value':'Request reconcile review'}</button>)}</div>
        </div>
      </details>)}
    </>}
    {!!project.discovery.snapshots.length&&<details><summary>Imported provenance and review history</summary>{project.discovery.snapshots.map(e=><p key={e.snapshot.id}>{e.fileName} · imported {e.importedAt} · collected {e.snapshot.collectedAt} · {e.snapshot.observations.length} observations</p>)}<p>{project.discovery.reviews.length} decisions retained in the saved project and exported report. New observations supersede old comparisons without deleting their history.</p></details>}
  </section>
}
