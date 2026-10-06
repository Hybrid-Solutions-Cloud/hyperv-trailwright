import {activeSdnFields} from './sdnActiveFields'
import {SdnPanel} from './SdnPanel'
import {SdnEvidencePanel} from './SdnEvidencePanel'
import {TopologyPanel} from './TopologyPanel'
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { collections, defaultAnswers, hostingFields, newRecord, productFields, sections, visibleField, type Answers, type Collection, type Field } from './catalog'
import { componentTotals, controllerArchitectures, hosts, lifecycles, MAX_PROJECT_BYTES, newComponent, newProject, parseProject, products, scopes, serializeProject, setupOwners, STORAGE_KEY, type Component, type Project } from './project'
import { validate, type Finding } from './validation'
import { download, exportPackage, exportMarkdown, exportWorkbook, exportPdf } from './exports'
import { demoProject } from './scenarios'
import { importSurveyor } from './surveyorImport'
import { LicensingPanel } from './LicensingPanel'
import { sanitizeProject } from './sanitize'
import metadata from '../package.json'
import { referenceOptions } from './references'
import { dependencyOrder } from './managementValidation'
import { stagePlan } from './stagePlan'
import {projectReadiness} from './projectReadiness'
import { vmmProfilePlan } from './vmmProfile'
import { DiscoveryPanel } from './DiscoveryPanel'
import { StoragePanel } from './StoragePanel'
import {NetworkPanel} from './NetworkPanel'
import {OperationsPanel} from './OperationsPanel'
import { designProgress, reviewTarget, type ReviewTarget } from './review'
import {contextLabels,managementSources,scopeDescription,workflowSections} from './workflow'
import {SupportPanel} from './SupportPanel'
import {OmePanel} from './OmePanel'
import {omePlanningFields,omeMilestones} from './omeFields'
import {managementProductFields,managementSystemFields} from './managementProductFields'
import {ManagementProductPanel} from './ManagementProductPanel'
import {HostingPanel} from './HostingPanel'
import {hostingContractFields} from './hostingContractFields'
import {AvailabilityPanel} from './AvailabilityPanel'
import {PrerequisitePanel} from './PrerequisitePanel'
import {HostDeploymentPanel} from './HostDeploymentPanel'
import {recordFields} from './availabilityDetailFields'
import {omitComponent,restoreComponent} from './componentOmissions'
import {OmittedComponentsPanel} from './OmittedComponentsPanel'
import {ManagementAdvisorPanel} from './ManagementAdvisorPanel'
import { collectionApplies } from './collectionScope'
import { activeDecisionFields } from './componentDecisions'
import { Breadcrumb, FieldHelp } from '@configurators/ui'
import { hintFor } from './fieldHints'

type Section = typeof sections[number]['key']
function loadDraft(): { project: Project; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return { project: saved ? parseProject(saved) : newProject(), error: '' }
  } catch (error) {
    return { project: newProject(), error: `The saved draft could not be opened. It has been preserved in browser storage. ${String(error)}` }
  }
}
function labelledControl(control:ReactNode,labelId:string) { return isValidElement(control)?cloneElement(control as ReactElement<{'aria-labelledby'?:string}>,{'aria-labelledby':labelId}):control }
function Label({ children, title, fieldKey }: { children: ReactNode; title: string; fieldKey?:string }) { const id=useId();return <label className="field" data-field-key={fieldKey}><span id={id}>{title}</span>{labelledControl(children,id)}</label> }
function Options({ options, value, onChange, blank = false, ...attributes }: { options: Record<string, string>; value: string; onChange: (value: string) => void; blank?: boolean; 'aria-labelledby'?:string }) {
  return <select {...attributes} value={value} onChange={event => onChange(event.target.value)}>{blank && <option value="">Choose…</option>}{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
}

function Fields({ fields, values, onChange, project, prefix }: { fields: Field[]; values: Answers; onChange: (value: Answers) => void; project: Project; prefix: string }) {
  const groupId=useId()
  return <div className="fields">{fields.filter(f => visibleField(f, values)).map(field => {
    const value = values[field.key], id = `${prefix}-${field.key}`, set = (value: string | number | boolean) => onChange({ ...values, [field.key]: value })
    const labelId=groupId+encodeURIComponent(field.key)
    let input: ReactNode
    if (field.type === 'select') input = <Options value={String(value)} options={field.options!} onChange={set} blank />
    else if (field.type === 'reference') input = <Options value={String(value)} options={Object.fromEntries(referenceOptions(project, field.collection!).map(row => [row.id, row.name]))} onChange={set} blank />
    else if (field.type === 'boolean') input = <input type="checkbox" checked={Boolean(value)} onChange={event => set(event.target.checked)} />
    else if (field.type === 'notes') input = <textarea rows={3} value={String(value)} maxLength={16000} onChange={event => set(event.target.value)} />
    else if (field.type === 'number') input = <input type="number" value={Number(value)} min={field.min ?? 0} max={field.max} step="any" onChange={event => set(event.target.value === '' ? 0 : Number(event.target.value))} />
    else input = <input value={String(value)} maxLength={16000} onChange={event => set(event.target.value)} />
    return <label key={id} data-field-key={field.key} className={`field ${field.type === 'notes' ? 'wide' : ''} ${field.type === 'boolean' ? 'check' : ''}`}>
      <span id={labelId}>{field.label}{field.required && <span className="required"> *</span>}</span>{hintFor(field) && <FieldHelp label={field.label}>{hintFor(field)}</FieldHelp>}{labelledControl(input,labelId)}
    </label>
  })}</div>
}

function Records({ collection, project, change }: { collection: Collection; project: Project; change: (project: Project) => void }) {
  const [addedId,setAddedId]=useState('')
  const sectionRef=useRef<HTMLElement>(null)
  useEffect(()=>{
    if(!addedId)return
    const row=Array.from(sectionRef.current?.querySelectorAll<HTMLDetailsElement>('details[data-record-id]')||[]).find(r=>r.dataset.recordId===addedId)
    if(row){row.open=true;(row.querySelector<HTMLElement>('[data-field-key="name"] input')||row.querySelector<HTMLElement>('input,select,textarea'))?.focus()}
  },[addedId])
  const records = project.design[collection.key]
  const setRows = (rows: typeof records) => change({ ...project, design: { ...project.design, [collection.key]: rows } })
  return <section className="panel" ref={sectionRef}>
    <div className="section-heading"><div><h2>{collection.title}</h2><p>{collection.description}</p></div><button onClick={() => {const row=newRecord(collection);setRows([...records,row]);setAddedId(row.id)}}>+ Add {collection.singular}</button></div>
    {records.length === 0 && <p className="empty">No {collection.title.toLowerCase()} recorded. Add the resources applicable to your design.</p>}
    {records.map((row, index) => <details className="resource" data-record-id={row.id} key={row.id} open={records.length === 1 || undefined}>
      <summary><strong>{String(row.values.name || `New ${collection.singular}`)}</strong><span>{String(row.values.lifecycle || `Record ${index + 1}`)}</span></summary>
      <div className="resource-body"><Fields fields={recordFields(project,collection,row.values)} values={row.values} project={project} prefix={row.id} onChange={values => setRows(records.map(r => r.id === row.id ? { ...r, values } : r))} />
        <div className="record-footer"><small>Reference: {row.id}</small><button className="danger" onClick={() => { if (window.confirm(`Remove ${row.values.name || collection.singular} from this design?`)) setRows(records.filter(r => r.id !== row.id)) }}>Remove record</button></div>
      </div>
    </details>)}
  </section>
}

function ComponentEditor({ component: c, project, section, change, remove }: { component: Component; project: Project; section: Section; change: (component: Component) => void; remove: () => void }) {
  const set = <K extends keyof Component>(key: K, value: Component[K]) => change({ ...c, [key]: value })
  const text = (key: 'name' | 'owner' | 'version' | 'placement' | 'failureDomain' | 'endpoint' | 'credentialRef' | 'applicationHa' | 'recovery', label: string) => <Label title={label} fieldKey={key}><input value={c[key]} maxLength={16000} onChange={e => set(key, e.target.value)} /></Label>
  return <details className="resource" data-record-id={c.id} open={project.components.length === 1 || undefined}>
    <summary><strong>{c.name || products[c.product]}</strong><span>{products[c.product]} · {lifecycles[c.lifecycle]}</span></summary>
    <div className="resource-body">
      {section === 'management' && <div className="fields">{text('name', 'Component / server name')}{text('owner', 'Owner')}
        <Label title="Lifecycle" fieldKey="lifecycle"><Options options={c.product==='ome'?{...lifecycles,new:'New appliance — manual deployment',configure:'Configure existing appliance — operator handoff'}:lifecycles} value={c.lifecycle} onChange={v => set('lifecycle', v as Component['lifecycle'])} /></Label>
        {text('version', 'Exact product version / update rollup')}
      </div>}
      {section === 'hosting' && <>
        <div className="fields">{text('name', 'Component / server name')}{text('owner', 'Owner')}{text('version', 'Exact product version')}
          <Label title="Hosting platform"><Options options={Object.fromEntries(Object.entries(hosts).filter(([key]) => !(c.product === 'ome' && key === 'physical')))} value={c.hosting} onChange={v => set('hosting', v as Component['hosting'])} /></Label>
          {text('placement', 'Hosting cluster / resource / physical server')}{text('failureDomain', 'Failure domain')}{text('endpoint', 'Management endpoint')}
          {(['vCpu', 'memoryGiB', 'diskGiB'] as const).map(key => <Label key={key} title={{ vCpu: 'vCPU (VMs)', memoryGiB: 'Memory (GiB)', diskGiB: 'Disk (GiB)' }[key]}><input type="number" min={0} value={c[key]} onChange={e => set(key, Number(e.target.value))} /></Label>)}
          <label className="field check"><span>Infrastructure failover protection</span><input type="checkbox" checked={c.infrastructureHa} onChange={e => set('infrastructureHa', e.target.checked)} /></label>
          {text('applicationHa', 'Application HA topology')}{text('recovery', 'Recovery / backup plan')}{text('credentialRef', 'Runtime credential reference')}
        </div>
        <HostingPanel project={project} componentId={c.id}/>
        <Fields fields={hostingFields.filter(f=>!hostingContractFields.some(p=>p.key===f.key)&&(c.product!=='ome'||!['installProduct','configureGuest','createInfrastructure'].includes(f.key)))} values={c.hostingDetails} project={project} prefix={`${c.id}-hosting`} onChange={v=>set('hostingDetails',v)}/>
        <details open><summary>Resource identity, provider contract and owners</summary><Fields fields={hostingContractFields.filter(f=>!f.key.startsWith('physical')||c.hosting==='physical')} values={c.hostingDetails} project={project} prefix={`${c.id}-hosting`} onChange={v=>set('hostingDetails',v)}/></details>
      </>}
      {section === 'products' && <>
        {c.product === 'ome' && <><p className="notice">OME is a manually deployed appliance. Its resources count in this design; appliance installation is an operator task.</p>
          <div className="fields"><Label title="Managed device count"><input type="number" min={0} value={c.ome.devices} onChange={e => set('ome', { ...c.ome, devices: Number(e.target.value) })} /></Label>
            {Object.entries({ plugins: 'Plugins', discoveryScope: 'Device / iDRAC discovery scope', firmwareCatalog: 'Firmware catalog / baseline', integrations: 'Integrations and owners', entitlement: 'License / plugin entitlement', manualSteps: 'Manual deployment and acceptance steps' }).map(([key, label]) => <Label key={key} title={label}><textarea rows={3} maxLength={16000} value={String(c.ome[key as keyof Component['ome']])} onChange={e => set('ome', { ...c.ome, [key]: e.target.value })} /></Label>)}
          </div>
        </>}
        {c.product==='ome'?<>
          <OmePanel component={c}/>
          <Fields fields={productFields.ome.filter(f=>!omePlanningFields.some(p=>p.key===f.key))} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/>
          <details open><summary>Capacity, plug-ins and discovery design</summary><Fields fields={omePlanningFields.filter(f=>!f.key.startsWith('manual'))} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/></details>
          {Object.entries(omeMilestones).map(([key,label])=><details key={key}><summary>{label}</summary><Fields fields={omePlanningFields.filter(f=>['manual_','manualOwner_','manualEvidence_','manualAt_'].some(prefix=>f.key===prefix+key))} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/></details>)}
        </>:<>
          <ManagementProductPanel project={project} componentId={c.id}/>
          <Fields fields={managementSystemFields.filter(f=>f.key!=='physicalCores'||c.hosting==='physical')} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/>
          <Fields fields={productFields[c.product].filter(f=>![...managementSystemFields,...(managementProductFields[c.product]||[])].some(p=>p.key===f.key))} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/>
          <details open><summary>Product role, dependencies and acceptance</summary><Fields fields={managementProductFields[c.product]||[]} values={c.productDetails} project={project} prefix={`${c.id}-product`} onChange={v=>set('productDetails',v)}/></details>
        </>}
      </>}
      <div className="record-footer"><small>{c.id}</small><button className="danger" onClick={remove}>Omit from design</button></div>
    </div>
  </details>
}

export default function App() {
  const [initial] = useState(loadDraft)
  const [project, setProject] = useState(initial.project)
  const [section, setSection] = useState<Section>('project')
  const [message, setMessage] = useState(initial.error)
  const [storageError, setStorageError] = useState('')
  const [storageEnabled, setStorageEnabled] = useState(!initial.error)
  const [busy, setBusy] = useState(false)
  const [shareable, setShareable] = useState(false)
  const [showAllSections,setShowAllSections]=useState(false)
  const [focusRequest,setFocusRequest] = useState<ReviewTarget|null>(null)
  const sectionHeading = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const surveyorInput = useRef<HTMLInputElement>(null)
  const findings = validate(project), errors = findings.filter(f => f.severity === 'error')
  const readiness=projectReadiness(project,findings)
  const totals = componentTotals(project)
  const current = sections.find(s => s.key === section)!
  const path=workflowSections(project,showAllSections,section)
  const position=path.findIndex(s=>s.key===section)
  const exportProject = () => shareable ? sanitizeProject(project) : project
  const change = (next: Project) => setProject({ ...next, updatedAt: new Date().toISOString() })
  useEffect(()=>{sectionHeading.current?.focus({preventScroll:true})},[section])
  useEffect(()=>{
    if(!focusRequest || focusRequest.section!==section)return
    const record=focusRequest.recordId?Array.from(document.querySelectorAll<HTMLElement>('[data-record-id]')).find(el=>el.dataset.recordId===focusRequest.recordId):document.querySelector('main')
    if(record instanceof HTMLDetailsElement)record.open=true
    const field=focusRequest.fieldKey?Array.from(record?.querySelectorAll<HTMLElement>('[data-field-key]') || []).find(el=>el.dataset.fieldKey===focusRequest.fieldKey):null
    const control=(field || record)?.querySelector<HTMLElement>('input:not([type="file"]),select,textarea')
    for(let ancestor=control?.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor instanceof HTMLDetailsElement)ancestor.open=true
    if(control){control.focus({preventScroll:true});control.scrollIntoView({block:'center'})}else sectionHeading.current?.focus()
  },[focusRequest,section])

  useEffect(() => {
    if (!storageEnabled) return
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); setStorageError('') }
      catch (error) { setStorageError(`Draft not saved: ${String(error)}`) }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [project, storageEnabled])

  const act = async (fn: () => void | Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  async function open(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MiB import limit.')
    const next = parseProject(await file.text())
    if (window.confirm('Replace the current draft with this project? Download your current draft first if you need to keep it.')) {
      setProject(next); setStorageEnabled(true); setMessage(`Opened ${next.name || 'untitled project'}.`)
    }
  }
  function save() { download('hyperv-configurator.json', serializeProject(project), 'application/json'); setMessage('Project downloaded. Keep this file to reopen the complete design.') }
  const navigate = (key: Section) => { setFocusRequest(null);setSection(key); window.scrollTo({ top: 0 }) }
  const openFinding = (finding:Finding) => { const target=reviewTarget(project,finding);setFocusRequest(target);setSection(target.section) }

  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="./"><span className="brand-icon">HV</span><span>Hyper-V<strong>Trailwright</strong></span></a>
      <p className="sidebar-caption">From platform decisions to a deployment design.</p>
      <nav aria-label="Design sections">{path.map((s, index) => <button key={s.key} aria-current={section === s.key ? 'step' : undefined} className={section === s.key ? 'active' : ''} onClick={() => navigate(s.key)}><span>{String(index + 1).padStart(2, '0')}</span>{s.title}{findings.some(f => f.section === s.key && f.severity === 'error') && <i aria-label="Has unresolved items">•</i>}</button>)}</nav>
      <label className="field check"><span>Show all 14 sections</span><input type="checkbox" checked={showAllSections} onChange={event=>setShowAllSections(event.target.checked)}/></label>
      <div className="sidebar-bottom"><a href="https://github.com/Hybrid-Solutions-Cloud/hyperv-trailwright#readme">Configurator documentation ↗</a><a href="../hyperv-surveyor/">Open Hyper-V Surveyor ↗</a><a href="../">All Labs tools ↗</a><small>Version {metadata.version} · Development</small></div>
    </aside>
    <main>
      <Breadcrumb items={[{ label: 'Labs', href: '../' }, { label: 'Hyper-V Trailwright' }]} />
      <div className="project-bar"><div><strong>{project.name || 'Untitled Hyper-V design'}</strong><span>Revision {project.revision} · {storageEnabled && !storageError ? 'Autosave enabled' : 'Download to keep your draft'}</span></div>
        <div className="actions"><button className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>Open project</button><button disabled={busy} onClick={() => act(save)}>Download project</button></div>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void act(() => open(file)) }} />
      </div>
      <div className="content">
        <header><p className="eyebrow">{scopes[project.scope]}</p><h1 ref={sectionHeading} tabIndex={-1}>{current.title}</h1><p>{current.description}</p></header>
        {section==='project'&&<p className="notice">{scopeDescription(project)}</p>}
        {message && <div className="notice" role="status">{message}<button className="text-button" onClick={() => setMessage('')}>Dismiss</button></div>}
        {storageError && <div className="notice error" role="alert">{storageError}</div>}
        {!storageEnabled && <div className="notice error">Autosave is paused to preserve the unreadable saved file. <button onClick={() => { const raw = localStorage.getItem(STORAGE_KEY); if (raw) download('saved-draft-recovery.json', raw, 'application/json') }}>Download recovery copy</button> <button onClick={() => setStorageEnabled(true)}>Replace saved draft</button></div>}
        <div className="stats"><div><strong>{totals.instances}</strong><span>Management / SDN instances</span></div><div><strong>{totals.vCpu}</strong><span>vCPU / host CPU allowance</span></div><div><strong>{totals.memoryGiB}</strong><span>Management / SDN GiB RAM</span></div><div><strong>{errors.length}</strong><span>Unresolved design items</span></div></div>

        {section === 'project' && <>
          <section className="panel"><h2>What are you designing?</h2><div className="choices">{Object.entries(scopes).map(([key, label]) => <button className={project.scope === key ? 'choice selected' : 'choice'} key={key} aria-pressed={project.scope === key} onClick={() => change({ ...project, scope: key as Project['scope'] })}>{label}</button>)}</div>
            <div className="fields"><Label title="Project name" fieldKey="name"><input value={project.name} maxLength={16000} onChange={e => change({ ...project, name: e.target.value })} /></Label><Label title="Design owner" fieldKey="owner"><input value={project.owner} maxLength={16000} onChange={e => change({ ...project, owner: e.target.value })} /></Label>
              <Label title="Environment"><Options value={project.environment} options={{ lab: 'Lab', poc: 'Proof of concept', production: 'Production', hosted: 'Hosted service' }} onChange={v => change({ ...project, environment: v as Project['environment'] })} /></Label>
              <Label title="Design revision"><input type="number" min={1} step={1} value={project.revision} onChange={e => change({ ...project, revision: Math.max(1, Math.floor(Number(e.target.value))) })} /></Label>
              {(['scenarioId','customer','naming','supportTarget'] as const).map(key=><Label key={key} title={contextLabels[key]} fieldKey={key}><input maxLength={16000} value={project.context[key]} onChange={event=>change({...project,context:{...project.context,[key]:event.target.value}})}/></Label>)}
            </div>
            <p>Each resource records its own lifecycle, placement and deployment owner. Switching scope preserves your entered data.</p>
            <button className="secondary" disabled={busy} onClick={() => surveyorInput.current?.click()}>Import Hyper-V Surveyor plan</button>
            <input ref={surveyorInput} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void act(async () => { if (file.size > MAX_PROJECT_BYTES) throw new Error('Surveyor file exceeds 2 MiB.'); const next = await importSurveyor(await file.text(), file.name); serializeProject(next); if (window.confirm('Start a Configurator draft from this Surveyor plan? This replaces the current draft; the source file is unchanged.')) { setProject(next); setStorageEnabled(true); setMessage('Imported requirements and source evidence. Review placement, HA and deployment identities before export.') } }) }} />
          </section>
          <section className="panel"><h2>Explore a reference design</h2><p>Examples use fictional data. They are starting points for testing the questionnaire, not qualified deployment configurations.</p><div className="actions">
            <select id="example" defaultValue="1" aria-label="Reference design">{['Existing VMware management guests', 'Hyper-V management HA and VMM bare metal', 'Physical management and prepared hosts', 'Existing VMM services and new cluster', 'Offline administration', 'Manual Dell OME appliance', 'VMM-owned SDN', 'Host-resident Network Controller'].map((label, i) => <option value={i + 1} key={label}>{label}</option>)}</select>
            <button className="secondary" onClick={() => { if (window.confirm('Replace the current draft with this fictional example?')) { setProject(demoProject(Number((document.getElementById('example') as HTMLSelectElement).value))); setStorageEnabled(true) } }}>Load example</button>
            <button className="secondary" onClick={() => { if (window.confirm('Start a new project? Download the current project first to keep it.')) { setProject(newProject()); setStorageEnabled(true) } }}>New blank project</button>
          </div></section>
        </>}

        {section === 'management' && <>
          {project.scope==='cluster'&&<section className="panel"><h2>Management dependency for this cluster</h2><p>{scopeDescription(project)}</p><div className="fields"><Label title="Management service source *" fieldKey="managementSource"><Options blank options={managementSources} value={project.context.managementSource} onChange={value=>change({...project,context:{...project.context,managementSource:value as Project['context']['managementSource']}})}/></Label>{(['managementOwner','managementEvidence'] as const).map(key=><Label key={key} title={`${contextLabels[key]} *`} fieldKey={key}><textarea rows={3} maxLength={16000} value={project.context[key]} onChange={event=>change({...project,context:{...project.context,[key]:event.target.value}})}/></Label>)}</div><p>Add known services below when their capacity, hosting or product configuration is part of the handoff.</p></section>}
          <section className="panel"><h2>Management requirements</h2><div className="fields">{Object.entries({ offline: 'Must operate without Azure connectivity', bareMetal: 'Provision host operating systems from bare metal', tenantClouds: 'Tenant clouds, quotas or self-service', monitoring: 'Central SCOM monitoring', browserAdmin: 'Browser-based administration', managementHa: 'Management availability across host failures', previewsAccepted: 'Preview capabilities accepted for evaluation' }).map(([key, label]) => <label className="field check" key={key}><span>{label}</span><input type="checkbox" checked={project.requirements[key as keyof Project['requirements']]} onChange={e => change({ ...project, requirements: { ...project.requirements, [key]: e.target.checked } })} /></label>)}</div></section>
          <ManagementAdvisorPanel project={project} change={change}/><section className="panel"><h2>Select management components</h2><p>Add one record for each planned or existing instance. HA peers and shared services get their own placement and capacity.</p><div className="product-grid">{Object.entries(products).map(([key, label]) => <button className="secondary" key={key} onClick={() => change({ ...project, components: [...project.components, newComponent(key as Component['product'])] })}>+ {label}</button>)}</div></section>
        </>}
        {(['management', 'hosting', 'products'] as Section[]).includes(section) && <section className="panel"><h2>Management inventory</h2>{project.components.length === 0 && <p>Add selected components in Management requirements.</p>}{project.components.map(c => <ComponentEditor key={c.id} component={c} project={project} section={section} change={next => change({ ...project, components: project.components.map(p => p.id === c.id ? next : p) })} remove={()=>{change(omitComponent(project,c.id));setSection('management');setFocusRequest({section:'management',recordId:c.id,fieldKey:'omissionReason'})}} />)}</section>}
        {section==='management'&&<OmittedComponentsPanel project={project} change={change} restore={id=>{change(restoreComponent(project,id));setFocusRequest({section:'management',recordId:id,fieldKey:'name'})}}/>}

        {section === 'sdn' && <section className="panel"><h2>SDN architecture and ownership</h2><div className="fields">
          <Label title="SDN scope"><Options options={{ none: 'No SDN', existing: 'Use existing SDN', new: 'New SDN deployment', expand: 'Expand existing SDN' }} value={project.sdn.scope} onChange={v => change({ ...project, sdn: { ...project.sdn, scope: v as Project['sdn']['scope'] } })} /></Label>
          {project.sdn.scope !== 'none' && <><Label title="Controller architecture"><Options options={controllerArchitectures} value={project.sdn.architecture} onChange={v => change({ ...project, sdn: { ...project.sdn, architecture: v as Project['sdn']['architecture'] } })} /></Label><Label title="Setup owner"><Options options={setupOwners} value={project.sdn.owner} onChange={v => change({ ...project, sdn: { ...project.sdn, owner: v as Project['sdn']['owner'] } })} /></Label>
            {Object.entries({ osVersion: 'OS edition / exact build', toolVersion: 'VMM / PowerShell tooling version', controllerEndpoint: 'Controller API / DNS / IP', underlay: 'Underlay / provider network design', vipPool: 'VIP pools', tenantNetworks: 'Tenant network design', bgpPeers: 'BGP routing design', certificates: 'Certificate and identity prerequisites', securityPolicy: 'Network security / isolation policy', recovery: 'Recovery / topology support evidence' }).map(([key, label]) => <Label title={label} key={key} fieldKey={key}><textarea rows={2} maxLength={16000} value={String(project.sdn[key as keyof Project['sdn']])} onChange={e => change({ ...project, sdn: { ...project.sdn, [key]: e.target.value } })} /></Label>)}
            {(['loadBalancer', 'gateways'] as const).map(key => <label className="field check" key={key}><span>{key === 'loadBalancer' ? 'Load balancing / NAT required' : 'Gateway / routed connectivity required'}</span><input type="checkbox" checked={project.sdn[key]} onChange={e => change({ ...project, sdn: { ...project.sdn, [key]: e.target.checked } })} /></label>)}
          </>}
        </div>{project.sdn.scope !== 'none' && <><Fields fields={activeSdnFields(project.sdn)} values={project.sdn.details} project={project} prefix="sdn-fabric" onChange={details=>change({...project,sdn:{...project.sdn,details}})} /><SdnPanel project={project}/><SdnEvidencePanel project={project} change={change}/></>}</section>}

        {(section === 'network' || section === 'operations') && <section className="panel" aria-label={section === 'network' ? 'Network component decisions' : 'Backup and monitoring decisions'}><h2>{section === 'network' ? 'Network components in this design' : 'Backup and monitoring in this design'}</h2>
          <p>{section === 'network' ? 'Answer each question first. A used component shows only the questions that apply to it. A not-used answer hides its questions and removes it from exports; your earlier answers stay in the project.' : 'Decide whether backup and monitoring are part of this design. A not-used answer hides the related operations questions and removes them from exports; your earlier answers stay in the project.'}</p>
          <Fields fields={activeDecisionFields(project, section)} values={project.decisions} project={project} prefix={`decisions-${section}`} onChange={decisions => change({ ...project, decisions })} /></section>}
        {collections.filter(c => c.section === section && collectionApplies(c, project)).map(c => <Records key={c.key} collection={c} project={project} change={change} />)}
        {section === 'hosting' && <section className="panel"><h2>Prerequisite order</h2><p>Link existing or external services before declaring new ones. These waves describe the dependencies you entered; they do not submit deployment jobs. VM restart protection, application availability and database availability are separate decisions.</p>{['bootstrap', 'recovery'].map(phase => {
          const order = dependencyOrder(project, phase)
          const name = (id: string) => referenceOptions(project, '$resources').find(r => r.id === id)?.name || id
          return <div key={phase}><h3>{phase === 'bootstrap' ? 'Initial deployment' : 'Cold-start recovery'}</h3>{!order.waves.length && !order.blocked.length && <p>No dependencies recorded for this phase.</p>}<ol>{order.waves.map((wave, i) => <li key={i}>{wave.map(name).join('; ')}</li>)}</ol>{!!order.blocked.length && <p className="notice error">Cycle or blocked prerequisite: {order.blocked.map(name).join('; ')}</p>}</div>
        })}</section>}
        {section === 'hosting' && <AvailabilityPanel project={project} />}
        {section === 'identity' && <PrerequisitePanel project={project} />}
        {(section === 'hardware'||section === 'topology') && <HostDeploymentPanel project={project} />}
        {section === 'licensing' && <LicensingPanel project={project} />}
        {(section==='products'||section==='sdn')&&<SupportPanel project={project}/>}
        {section === 'storage' && <StoragePanel project={project} />}
        {section === 'network' && <NetworkPanel project={project} />}
        {section === 'operations' && <OperationsPanel project={project} />}
        {section === 'automation' && <section className="panel"><h2>Implementation sequence</h2><p>Enter target and prerequisite IDs as a JSON string array or separate UUIDs with commas, semicolons or whitespace. Explicit prerequisites determine the waves. Reported completion requires evidence and a timestamp; it is not independently verified deployment success.</p>{(() => {
          const plan = stagePlan(project)
          return <><ol>{plan.waves.map((wave, index) => <li key={index}>{wave.map(id => plan.stages.find(s => s.id === id)!.name).join('; ')}</li>)}</ol><div className="table-scroll"><table><thead><tr><th>Stage</th><th>Reported state</th><th>Next review</th></tr></thead><tbody>{plan.stages.map(stage => <tr key={stage.id}><td>{stage.name}</td><td>{stage.reportedState || 'Not recorded'}</td><td>{stage.disposition.replace(/-/g, ' ')}</td></tr>)}</tbody></table></div>{!!plan.findings.length && <ul>{plan.findings.map((f, index) => <li key={index}>{f.message}</li>)}</ul>}</>
        })()}</section>}
        {section === 'automation' && (() => { const plan = vmmProfilePlan(project); return <section className="panel"><h2>VMM physical-profile creation</h2><p>{plan.status === 'not-selected' ? 'Define a new VMM profile in Hosts and provisioning to prepare its creation handoff.' : `${plan.targets.length} desired profiles · ${plan.status}`}</p><p>Review the image, NIC profiles, disk layout and runtime credential references. The package records the desired profile settings for your existing implementation process. It includes no deployment scripts.</p>{plan.status !== 'not-selected' && <ol>{plan.steps.map(step=><li key={step}>{step}</li>)}</ol>}</section> })()}
          {section === 'operations' && <DiscoveryPanel project={project} change={change}/>}
          {section === 'review' && <>
          <section className="panel"><h2>Project readiness</h2><dl aria-label="Project readiness states"><dt>Design</dt><dd>{readiness.designState}</dd><dt>Runtime observations</dt><dd>{readiness.runtimeState}</dd><dt>Deployment verified</dt><dd>No</dd></dl><p>{readiness.counts.errors} errors; {readiness.counts.reviews} reviews; {readiness.counts.missingInputs} missing required inputs.</p><ul>{readiness.nextActions.map(a=><li key={a}>{a}</li>)}</ul></section>
          <section className="panel"><h2>Design handoff</h2><p>{errors.length ? `This draft has ${errors.length} unresolved items. The report includes each one.` : 'Required design checks passed. Review version support and implementation prerequisites before deployment.'}</p><p>Download the project to preserve every answer. Reports and environment files describe the selected design. Use the exported configuration with your existing implementation process.</p><div className="actions">
            <label className="field check"><span>Sanitize reports and package for sharing (replace free-text identities and inventory)</span><input type="checkbox" checked={shareable} onChange={e => setShareable(e.target.checked)} /></label>
            <button disabled={busy} onClick={() => act(() => exportPackage(exportProject()))}>{busy ? 'Preparing…' : 'Download design package (.zip)'}</button>
            <button className="secondary" disabled={busy} onClick={() => act(() => exportMarkdown(exportProject()))}>Markdown</button><button className="secondary" disabled={busy} onClick={() => act(() => exportPdf(exportProject()))}>PDF</button><button className="secondary" disabled={busy} onClick={() => act(() => exportWorkbook(exportProject()))}>Workbook</button>
          </div></section>
          <TopologyPanel project={shareable?sanitizeProject(project):project}/>
          <section className="panel"><h2>Required inputs by section</h2><p>This counts required fields on existing records. Unresolved rules and support reviews are shown separately; completing inputs does not certify deployment readiness.</p><div className="table-scroll"><table><caption>Design input progress</caption><thead><tr><th>Section</th><th>Required inputs supplied</th><th>Unresolved rules</th><th>Reviews</th></tr></thead><tbody>{designProgress(project,findings).map(s=><tr key={s.section}><td><a className="text-button" href={`#${s.section}`} onClick={event=>{event.preventDefault();navigate(s.section)}}>{s.title}</a></td><td>{s.answered} / {s.required}</td><td>{s.errors}</td><td>{s.reviews}</td></tr>)}</tbody></table></div></section>
          <section className="panel"><h2>Validation findings</h2>{findings.length === 0 ? <p>No design findings.</p> : <ul className="findings">{findings.map((f, index) => <li key={`${f.code}-${index}`}><span className={`badge ${f.severity}`}>{f.severity}</span><button className="text-button" onClick={() => openFinding(f)}>{f.message}</button></li>)}</ul>}</section>
        </>}
        <div className="step-footer"><button className="secondary" disabled={position===0} onClick={() => navigate(path[position-1].key)}>Previous</button><span>{position+1} of {path.length}</span><button onClick={() => section === 'review' ? void act(save) : navigate(path[position+1].key)}>{section === 'review' ? 'Save project' : 'Continue'}</button></div>
        <footer>Hyper-V Trailwright · Browser-based design · No inventory upload · v{metadata.version}</footer>
      </div>
    </main>
  </div>
}
