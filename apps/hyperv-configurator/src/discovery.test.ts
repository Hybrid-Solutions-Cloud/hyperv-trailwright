import { removeStorageV7 } from './testing/legacyStorage'
import { describe,it,expect } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs'
import { discoveryFixture } from './testing/discoveryFixture'
import { importDiscovery,driftRows,reviewDrift,driftPlan,confirmDiscoveryMapping } from './discovery'
import { observedFields,fieldType,validateSnapshot } from './discoveryContract'
import { parseProject,serializeProject,componentTotals } from './project'
import { environmentFiles,discoveryMarkdown } from './exports'
import { sanitizeProject } from './sanitize'
const now='2026-09-11T12:00:00Z'
const imported=async()=>{const f=discoveryFixture();return {...f,project:await importDiscovery(f.project,JSON.stringify(f.snapshot),'example.json',now)}}
describe('discovery import and provenance',()=>{
  it('hashes original UTF-8 bytes including a BOM and rejects invalid encoding',async()=>{
    const {project,snapshot}=discoveryFixture(),bytes=Uint8Array.from(Buffer.from('\uFEFF'+JSON.stringify(snapshot)))
    const next=await importDiscovery(project,bytes,'bom.json',now)
    expect(next.discovery.snapshots[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    await expect(importDiscovery(project,Uint8Array.from([255,254,0]),'invalid.json',now)).rejects.toThrow('UTF-8')
  })
  it('imports without changing the design, records original bytes and round-trips',async()=>{
    const {project,component,snapshot}=discoveryFixture(), source=JSON.stringify(snapshot,null,2)
    const next=await importDiscovery(project,source,'inventory.json',now)
    expect(next.components).toEqual([component]);expect(project.discovery.snapshots).toEqual([])
    expect(next.discovery.snapshots[0]).toMatchObject({sha256:createHash('sha256').update(source).digest('hex'),fileName:'inventory.json',importedAt:now,snapshot})
    expect(parseProject(serializeProject(next))).toEqual(next)
  })
  it('checks every declared observation field against the owned design schema',()=>{
    for(const [kind,fields]of Object.entries(observedFields))for(const field of fields)expect(['string','number','boolean']).toContain(fieldType(kind as keyof typeof observedFields,field))
  })
  it('rejects unrelated projects, wrong types, missing targets and provider mismatches',async()=>{
    for(const mutation of ['project','target','type','provider']) {
      const {project,snapshot}=discoveryFixture()
      if(mutation==='project')snapshot.projectId='other'
      if(mutation==='target')snapshot.observations[0].targetId='missing'
      if(mutation==='type')snapshot.observations[0].resourceType='hosts'
      if(mutation==='provider')snapshot.source.provider='vsphere'
      await expect(importDiscovery(project,JSON.stringify(snapshot),'file',now)).rejects.toThrow()
    }
  })
  it('rejects malformed, future, duplicate, oversized and secret-bearing files atomically',async()=>{
    const {project,snapshot}=discoveryFixture(),source=JSON.stringify(snapshot)
    const next=await importDiscovery(project,source,'file',now)
    await expect(importDiscovery(next,source,'again',now)).rejects.toThrow('already imported')
    for(const input of ['{', ' '.repeat(2097153),source.replace('2026-09-11T11:00:00Z','2026-09-12T11:00:00Z'),source.replace('Configured CPU and startup memory only.','password=example-secret')])await expect(importDiscovery(project,input,'file',now)).rejects.toThrow()
    expect(project.discovery.snapshots).toEqual([])
  })
  it('rejects unknown properties, non-finite/range/type errors, duplicate identities and impossible dates',()=>{
    const {snapshot}=discoveryFixture()
    for(const mutate of [(s:any)=>s.extra=true,(s:any)=>s.observations[0].values.lifecycle='replace',(s:any)=>s.observations[0].values.vCpu='8',(s:any)=>s.observations[0].values.vCpu=-1,(s:any)=>s.observations.push(structuredClone(s.observations[0])),(s:any)=>s.collectedAt='2026-02-30T12:00:00Z',(s:any)=>s.observations[0].status='unavailable']) {
      const copy=structuredClone(snapshot);mutate(copy);expect(()=>validateSnapshot(copy)).toThrow()
    }
    expect(()=>validateSnapshot(JSON.parse(JSON.stringify(snapshot).replace('"vCpu":8','"__proto__":{"polluted":true}')))).toThrow()
    const provider:any=structuredClone(snapshot);provider.source.provider=['hyperv'];expect(()=>validateSnapshot(provider)).toThrow('provider')
    const status:any=structuredClone(snapshot);status.observations[0].status=['observed'];expect(()=>validateSnapshot(status)).toThrow('status')
    const resource:any=structuredClone(snapshot);resource.observations[0].status='unavailable';resource.observations[0].values={};resource.observations[0].resourceType=['components'];expect(()=>validateSnapshot(resource)).toThrow('resource type')
  })
  it('migrates actual schema 3 projects with empty discovery and rejects future field smuggling',()=>{
    const {project}=discoveryFixture(),legacy:any=structuredClone(project);removeStorageV7(legacy);legacy.schemaVersion=3
    expect(()=>parseProject(JSON.stringify(legacy))).toThrow('Schema 3')
    delete legacy.discovery
    const next=parseProject(JSON.stringify(legacy));expect(next.schemaVersion).toBe(32);expect(next.components).toEqual(project.components);expect(next.discovery).toEqual({snapshots:[],reviews:[]})
  })
})
describe('drift and local design review',()=>{
  it('adopts one reviewed field, preserves identity/lifecycle and updates capacity',async()=>{
    const {project}=await imported(),row=driftRows(project,now).find(r=>r.field==='vCpu')!
    const next=reviewDrift(project,row.key,4,'adopt','Example reviewer','Match verified VM capacity',now)
    expect(next.components[0]).toMatchObject({vCpu:8,memoryGiB:8,lifecycle:'preserve',id:project.components[0].id})
    expect(componentTotals(next).vCpu).toBe(8);expect(project.components[0].vCpu).toBe(4)
    expect(driftRows(next,now).find(r=>r.field==='vCpu')).toMatchObject({status:'matches',reviewCurrent:true})
  })
  it('preserves and records reconcile intent without mutating desired or external resources',async()=>{
    const {project}=await imported(),row=driftRows(project,now)[0]
    for(const decision of ['preserve','reconcile'] as const){const next=reviewDrift(project,row.key,row.desired,decision,'Operator','Reviewed difference',now);expect(next.components).toEqual(project.components);expect(driftPlan(next,now).automationReady).toBe(false);expect(driftRows(next,now)[0].reviewCurrent).toBe(true)}
  })
  it('requires explicit review and rejects stale edit baselines and new/external/replacement adoption',async()=>{
    const {project}=await imported(),row=driftRows(project,now)[0]
    expect(()=>reviewDrift(project,row.key,row.desired,'adopt','','',now)).toThrow('reviewer')
    expect(()=>reviewDrift(project,row.key,999,'adopt','Operator','Reason',now)).toThrow('changed')
    project.components[0].lifecycle='new';expect(()=>reviewDrift(project,row.key,row.desired,'adopt','Operator','Reason',now)).toThrow('existing')
    project.components[0].lifecycle='external';expect(()=>reviewDrift(project,row.key,row.desired,'adopt','Operator','Reason',now)).toThrow('existing')
  })
  it('invalidates prior decisions after a design edit or new snapshot',async()=>{
    const {project,snapshot}=await imported(),row=driftRows(project,now)[0]
    const reviewed=reviewDrift(project,row.key,row.desired,'preserve','Operator','Keep design',now)
    reviewed.components[0].memoryGiB=32;expect(driftRows(reviewed,now)[0].reviewCurrent).toBe(false)
    snapshot.id='newer';snapshot.collectedAt='2026-09-11T11:30:00Z'
    const next=await importDiscovery(reviewed,JSON.stringify(snapshot),'new',now);expect(driftRows(next,now)[0].review).toBeUndefined();expect(next.discovery.reviews).toHaveLength(1)
  })
  it('uses collection time rather than import order and never fills missing newer fields from older snapshots',async()=>{
    const {project,snapshot}=await imported();snapshot.id='older';snapshot.collectedAt='2026-09-10T11:00:00Z';snapshot.observations[0].values.vCpu=99
    let next=await importDiscovery(project,JSON.stringify(snapshot),'old',now);expect(driftRows(next,now).find(r=>r.field==='vCpu')!.observed).toBe(8)
    snapshot.id='latest';snapshot.collectedAt='2026-09-11T11:30:00Z';snapshot.observations[0].values={vCpu:12}
    next=await importDiscovery(next,JSON.stringify(snapshot),'new',now);expect(driftRows(next,now)).toHaveLength(1)
  })
  it('blocks stale, unavailable, ambiguous, changed-identity and orphaned targets',async()=>{
    const {project,snapshot}=await imported()
    expect(driftRows(project,'2026-09-20T12:00:00Z')[0]).toMatchObject({status:'blocked',canAdopt:false})
    for(const mode of ['same-time','identity','endpoint','unavailable']){
      const copy=structuredClone(snapshot);copy.id=mode;if(mode!=='same-time')copy.collectedAt='2026-09-11T11:30:00Z'
      if(mode==='identity')copy.observations[0].externalId='different'
      if(mode==='endpoint')copy.source.endpoint='different.example.test'
      if(mode==='unavailable'){copy.observations[0].status='unavailable';copy.observations[0].values={}}
      const next=await importDiscovery(project,JSON.stringify(copy),mode,now);expect(driftRows(next,now).every(r=>r.status==='blocked')).toBe(true)
    }
    project.components=[];expect(driftRows(project,now)[0].blockingReason).toContain('no longer exists')
    expect(()=>parseProject(serializeProject(project))).not.toThrow()
  })
  it('rejects forged review links and removes all source/history from sharing exports',async()=>{
    const {project}=await imported(),row=driftRows(project,now)[0],reviewed=reviewDrift(project,row.key,row.desired,'preserve','Private operator','Private reason',now)
    const shared=sanitizeProject(reviewed);expect(shared.discovery).toEqual({snapshots:[],reviews:[]});expect(serializeProject(shared)).not.toContain('Private operator');expect(serializeProject(shared)).not.toContain(project.discovery.snapshots[0].sha256)
    reviewed.discovery.reviews[0].observedValue=999;expect(()=>serializeProject(reviewed)).toThrow('does not match')
  })
  it('requires a distinct reviewed identity mapping before adopting moved inventory and preserves history',async()=>{
    const {project,snapshot}=await imported();snapshot.id='moved';snapshot.collectedAt='2026-09-11T11:30:00Z';snapshot.source.endpoint='moved.example.test'
    const next=await importDiscovery(project,JSON.stringify(snapshot),'moved',now),row=driftRows(next,now)[0]
    expect(row.priorIdentities[0]).toContain('example-host.example.test')
    expect(()=>confirmDiscoveryMapping(next,row.key,'','',now)).toThrow('reviewer')
    const mapped=confirmDiscoveryMapping(next,row.key,'Operator','Verified the VM GUID after host migration',now)
    expect(mapped.components).toEqual(next.components);expect(mapped.discovery.snapshots).toHaveLength(2);expect(mapped.discovery.reviews[0].decision).toBe('remap')
    expect(driftRows(mapped,now)[0]).toMatchObject({status:'drift',canAdopt:true,review:undefined})
    expect(parseProject(serializeProject(mapped))).toEqual(mapped)
    snapshot.id='moved-again';snapshot.collectedAt='2026-09-11T11:40:00Z';snapshot.observations[0].externalId='different-vm'
    const again=await importDiscovery(mapped,JSON.stringify(snapshot),'again',now);expect(driftRows(again,now)[0].status).toBe('blocked')
    expect(()=>confirmDiscoveryMapping(again,driftRows(again,now)[0].key,'Operator','Old evidence','2026-09-20T12:00:00Z')).toThrow('fresh')
  })
  it('exports provenance, comparisons and decisions with no execution claim',async()=>{
    const {project}=await imported(),files=environmentFiles(project)
    expect(files['discovery/snapshots.json']).toContain(project.discovery.snapshots[0].sha256)
    expect(JSON.parse(files['plans/drift-review.json'])).toMatchObject({executionState:'not-executed',automationReady:false})
    expect(discoveryMarkdown(project)).toContain('Unsigned operator evidence');expect(environmentFiles(project)).toEqual(files)
  })
})
