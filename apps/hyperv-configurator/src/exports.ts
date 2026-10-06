import {csvCell,sha256Hex} from '@configurators/output'
import {quorumConfiguration} from './quorumConfiguration'
import { dump } from 'js-yaml'
import PizZip from 'pizzip'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { collections, hostingFields, productFields, visibleField, type Answers, type Field } from './catalog'
import { componentTotals, products, scopes, serializeProject, type Project } from './project'
import { validate } from './validation'
import metadata from '../package.json'
import { licenseSummary, licensingPlan, licenseAssignmentSchedule, licenseUnitLabel } from './licensing'
import licensingGuide from '../docs/licensing-and-quotes.md?raw'
import {licensingRightsFields} from './licensingRights'
import {licenseCoverageKeys} from './licenseCoverageFields'
import {licenseDependencyKeys} from './licenseDependencyFields'
import { referenceOptions } from './references'
import { dependencyOrder } from './managementValidation'
import { stagePlan } from './stagePlan'
import {projectReadiness,readinessMarkdown} from './projectReadiness'
import { vmmProfilePlan } from './vmmProfile'
import vmmProfileGuide from '../docs/vmm-profile-creation.md?raw'
import { driftPlan, driftRows } from './discovery'
import discoveryGuide from '../docs/discovery-and-drift.md?raw'
import { storagePlan, storageSchedule, capacityText } from './storagePlan'
import {contextLabels,managementSources,scopeDescription} from './workflow'
import {SUPPORT_CATALOG,supportPlan} from './supportCatalog'
import {managementAdvice,managementQuestions,managementDecisionLabels,deploymentOwners} from './managementAdvisor'
import {omePlan} from './omePlan'
import {managementProductPlan} from './managementProductPlan'
import {hostingPlan} from './hostingPlan'
import {omissionSummary} from './componentOmissions'
import {availabilityPlan} from './availabilityPlan'
import {recordFields} from './availabilityDetailFields'
import {prerequisitePlan,prerequisiteSchedule} from './prerequisitePlan'
import {hostDeploymentPlan,hostDeploymentSchedule} from './hostDeploymentPlan'
import {storageReadiness,storageMetadataSchedule} from './storageReadiness'
import {networkDesign,networkPoolSchedule} from './networkDesign'
import {networkControlPlan,networkQosSchedule} from './networkControlPlan'
import {operationsPlan,operationsRecoverySchedule} from './operationsPlan'
import {topology,topologyViews,type TopologyView} from './topology'
export {topology} from './topology'
import {designSchedules} from './designSchedules'
import diagramsGuide from '../docs/diagrams-and-schedules.md?raw'
import {sdnPlan} from './sdnPlan'
import {sdnAcceptanceRequest,sdnEvidenceTemplate,sdnEvidenceAssessment} from './sdnEvidence'
import {sdnServices} from './sdnServices'
import {sdnServiceCollections} from './sdnServiceFields'
import {activeSdnFields,activeSdnDetails} from './sdnActiveFields'
import {sdnCollectionKeys} from './sdnFields'
import sdnGuide from '../docs/sdn-design.md?raw'
import sdnServicesGuide from '../docs/sdn-services.md?raw'
import sdnEvidenceGuide from '../docs/sdn-evidence.md?raw'
import {collectionApplies} from './collectionScope'
import {allActiveDecisionFields,decisionHiddenFields} from './componentDecisions'
import {networkDeviceKeys} from './componentDecisionFields'
import {infrastructureYaml} from './infrastructureYaml'

export function download(name: string, data: string | Blob | Uint8Array, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const safeMd = (value: unknown) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
const yaml = (value: unknown) => dump(value, { noRefs: true, sortKeys: true, lineWidth: 110 })
const hash = (data: Uint8Array) => sha256Hex(data)
function renderAnswer(project: Project, field: Field, value: unknown) {
  if (field.collection && value) return referenceOptions(project, field.collection).find(r => r.id === value)?.name || String(value)
  if (field.options && value) return field.options[String(value)] || String(value)
  return typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value ?? '')
}
function answerTable(project: Project, fields: Field[], values: Answers) {
  return ['| Decision | Value |', '| --- | --- |', ...fields.filter(f => visibleField(f, values)).map(f => `| ${safeMd(f.label)} | ${safeMd(renderAnswer(project, f, values[f.key])) || 'Not specified'} |`)].join('\n')
}

function contextRows(project:Project):string[][]{return [...Object.entries(contextLabels).map(([key,label])=>[label,project.context[key as keyof typeof contextLabels]||'Not specified']),['Management service source',project.context.managementSource?managementSources[project.context.managementSource]:'Not specified'],['Management boundary applicability',project.scope==='cluster'?'Required for this cluster-only design':'Retained context; required when cluster-only scope is selected']]}

export function designMarkdown(project: Project): string {
  serializeProject(project)
  const findings = validate(project), total = componentTotals(project)
  const lines = [
    `# ${safeMd(project.name || 'Hyper-V design')}`, '',
    `Revision: ${project.revision} · Configurator ${metadata.version} · Schema ${project.schemaVersion}`, '',
    `Owner: ${safeMd(project.owner)}  `, `Scope: ${scopes[project.scope]}  `, `Environment: ${project.environment}`, '',
    readinessMarkdown(project),
    `Status: ${findings.some(f => f.severity === 'error') ? 'Draft — unresolved design inputs' : 'Design handoff — runtime qualification required'}. Infrastructure has not been deployed by this tool.`, '',
    '## Project context','',scopeDescription(project),'','| Decision | Value |','| --- | --- |',...contextRows(project).map(([key,value])=>'| '+safeMd(key)+' | '+safeMd(value)+' |'),'',
    '## Management and SDN capacity', '',
    `${total.instances} VM/server/service instances; ${total.vCpu} vCPU or host CPU allowance; ${total.memoryGiB} GiB memory; ${total.diskGiB} GiB disk. Host-resident Network Controller consumes host resources without a controller VM. Externally supplied services may have separately accounted capacity.`, '',
    '## Management requirements', '', ...Object.entries(project.requirements).map(([key, value]) => `- ${key}: ${value ? 'Yes' : 'No'}`), '',
    '## Management components', '',
  ]
  for (const c of project.components) {
    lines.push(`### ${safeMd(c.name || products[c.product])}`, '', `Product: ${products[c.product]} · Lifecycle: ${c.lifecycle} · Hosting: ${c.hosting}`, '',
      '| Property | Value |', '| --- | --- |', ...Object.entries(c).filter(([key, value]) => typeof value !== 'object' && key !== 'id').map(([key, value]) => `| ${safeMd(key)} | ${safeMd(value)} |`), '',
      '#### Hosting and availability', '', answerTable(project, hostingFields, c.hostingDetails), '',
      '#### Product configuration', '', answerTable(project, productFields[c.product], c.productDetails), '')
    if (c.product === 'ome') lines.push('#### Dell OME manual deployment', '', 'OME appliance installation is an operator task; no automated appliance installation is generated.', '', ...Object.entries(c.ome).map(([key, value]) => `- ${safeMd(key)}: ${safeMd(value) || 'Not specified'}`), '')
  }
  lines.push('## SDN architecture and setup', '', ...Object.entries(project.sdn).filter(([key])=>key!=='details').map(([key, value]) => `- ${safeMd(key)}: ${safeMd(value) || 'Not specified'}`), '')
  lines.push('## Component decisions', '', 'Each component starts with a used / not-used decision. Only the follow-up answers that apply are listed.', '', answerTable(project, allActiveDecisionFields(project), project.decisions), '')
  for (const collection of collections) {
    if (!collectionApplies(collection, project)) continue
    lines.push(`## ${collection.title}`, '', collection.description, '')
    if (!project.design[collection.key].length) lines.push('No records supplied.', '')
    for (const row of project.design[collection.key]) lines.push(`### ${safeMd(row.values.name || collection.singular)}`, '', `Reference: ${row.id}`, '', answerTable(project, recordFields(project,collection,row.values), row.values), '')
  }
  lines.push(licensingMarkdown(project),licenseCoverageMarkdown(project), '',
    '## Validation and unresolved decisions', '', ...(findings.length ? findings.map(f => `- **${f.severity.toUpperCase()} — ${f.code}:** ${safeMd(f.message)}`) : ['No design findings.']), '',
    '## Execution boundary', '', 'This package is a design and operator handoff. It contains no resolved credentials. Use these configuration files with your existing implementation process. This package contains no deployment scripts. No deployment state is inferred from file generation.', '')
  lines.push(storageMarkdown(project))
  lines.push(networkMarkdown(project))
  lines.push(operationsMarkdown(project),sdnMarkdown(project),sdnEvidenceMarkdown(project))
  if (vmmProfilePlan(project).status !== 'not-selected') lines.push(vmmProfileMarkdown(project))
  lines.push(managementAdviceMarkdown(project),supportMarkdown(project),omeMarkdown(project),managementProductMarkdown(project,false),hostingMarkdown(project),omissionMarkdown(project),availabilityMarkdown(project),prerequisiteMarkdown(project),hostDeploymentMarkdown(project))
  return lines.join('\n')
}

export function billOfMaterialsCsv(project:Project):string {
  const rows:unknown[][]=[['Resource ID','Name','Category','Product / role','Lifecycle','Quantity','vCPU / CPU','Memory GiB','Disk GiB','Hosting / placement']]
  for(const c of [...project.components].sort((a,b)=>a.id.localeCompare(b.id))) rows.push([c.id,c.name,'Management component',products[c.product],c.lifecycle,1,c.vCpu,c.memoryGiB,c.diskGiB,c.hosting])
  if(project.sdn.scope!=='none') for(const r of [...project.design.sdnResources].sort((a,b)=>a.id.localeCompare(b.id))) rows.push([r.id,r.values.name,'SDN resource',r.values.role,r.values.lifecycle||'',1,Number(r.values.vCpu),Number(r.values.memoryGiB),Number(r.values.diskGiB),r.values.host||r.values.site||''])
  for(const h of [...project.design.hosts].sort((a,b)=>a.id.localeCompare(b.id))) rows.push([h.id,h.values.name,'Physical host',h.values.model||h.values.os||'',h.values.lifecycle,1,Number(h.values.cores),Number(h.values.memoryGiB),Number(h.values.localStorageGiB),h.values.site||''])
  // Firewalls, ToR switches and out-of-band devices appear only when their component decision is in use.
  for(const d of designSchedules(project).networkDevices) rows.push([d.DeviceId,d.Device,'Network device',`${d.Function}: ${[d.Vendor,d.Model].filter(Boolean).join(' ')}`,'',1,'','','',d.Rack])
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}

export function validationMarkdown(project:Project):string {
  const findings=validate(project)
  return ['# Configuration validation','',`Project: ${safeMd(project.name||project.id)} · revision ${project.revision}`,'',findings.length?'| Severity | Code | Section | Finding |':'No design findings.',...(findings.length?['| --- | --- | --- | --- |',...findings.map(f=>`| ${f.severity} | ${safeMd(f.code)} | ${safeMd(f.section)} | ${safeMd(f.message)} |`)]:[])].join('\n')
}

export function prerequisiteMarkdown(project:Project):string{
  const plan=prerequisitePlan(project)
  return ['## Identity, artifact and Arc prerequisite review','',plan.meaning,'',`Identity assignments: ${plan.identityBindings.length}. Artifact assignments: ${plan.mediaBindings.length}.`,'','| Prerequisite | Type | Evidence basis | State | Runtime qualification |','| --- | --- | --- | --- | --- |',...prerequisiteSchedule(project).map(r=>`| ${safeMd(r.Resource)} | ${r.Kind} | ${safeMd(r.Basis)} | ${r.State} | Pending |`),'','### Unresolved prerequisite findings','',...plan.findings.map(f=>`- **${f.code}:** ${safeMd(f.message)}`),'','Sources reviewed 2026-09-11:','',...plan.sources.map((s,i)=>`- [Primary prerequisite reference ${i+1}](${s})`),''].join('\n')
}
export function hostDeploymentMarkdown(project:Project):string{
  const plan=hostDeploymentPlan(project)
  return ['## Host deployment review','',plan.meaning,'','| Host | Observed state | OS action / owner | Hyper-V role / owner | Membership / owner | Replacement |','| --- | --- | --- | --- | --- | --- |',...hostDeploymentSchedule(project).map(h=>`| ${safeMd(h.Host)} | ${safeMd(h.ObservedState)} | ${safeMd(h.OsAction)} / ${safeMd(h.OsOwner)} | ${safeMd(h.HyperVRoleAction)} / ${safeMd(h.HyperVRoleOwner)} | ${safeMd(h.ClusterAction)} / ${safeMd(h.AdmissionOwner)} | ${h.Replacement?'Explicit review required':'No'} |`),'','### Deployment findings','',...plan.findings.map(f=>`- **${f.code}:** ${safeMd(f.message)}`),'','Primary references reviewed 2026-09-11:','',...plan.sources.map((url,i)=>`- [Host deployment reference ${i+1}](${url})`),''].join('\n')
}
export function omissionMarkdown(project:Project):string{
  const plan=omissionSummary(project)
  return ['## Omitted components','',plan.meaning,'','| Component | Product | Prior lifecycle | Omission reason | Review owner | Omitted at |','| --- | --- | --- | --- | --- | --- |',...plan.components.map(c=>'| '+[c.name||c.componentId,products[c.product],c.priorLifecycle,c.reason||'Review needed',c.reviewOwner||'Review needed',c.omittedAt].map(safeMd).join(' | ')+' |'),''].join('\n')
}
export function availabilityMarkdown(project:Project):string{
  const plan=availabilityPlan(project)
  return ['## Availability role and voting assessment','',plan.meaning,'',...plan.groups.flatMap(g=>[
    '### '+safeMd(g.name),'',`Strategy: ${g.strategy}; runtime qualification: pending.`,'',
    '| Voting measure | Value |','| --- | --- |',...Object.entries(g.voting).filter(([key])=>key!=='assumptions').map(([key,value])=>'| '+safeMd(key)+' | '+safeMd(value??'Unknown')+' |'),'',
    ...(g.details.sql.status==='not-applicable'?[]:['| SQL measure | Value |','| --- | --- |',...Object.entries(g.details.sql).map(([key,value])=>'| '+safeMd(key)+' | '+safeMd(value)+' |'),'']),
    `Shared physical host mappings: ${g.details.placement.sharedHosts.length}. Placement remains subject to its current/desired evidence contract.`,'',
    ...g.voting.assumptions.map(a=>'- '+safeMd(a)),...g.findings.map(f=>'- **'+f.code+'** '+safeMd(f.message)),...g.sources.map(s=>'- Source: '+s),'',
  ])].join('\n')
}
export function hostingMarkdown(project:Project):string{
  const plan=hostingPlan(project)
  return ['## Component hosting and action ownership','',plan.meaning,'',...plan.components.flatMap(c=>[
    '### '+safeMd(c.name),'',`Hosting: ${c.hosting}; lifecycle: ${c.lifecycle}; existing resource: ${safeMd(c.resourceId)||'Not supplied'}.`,'',
    '| Action | Selected | Owner |','| --- | --- | --- |',...c.actions.map(a=>'| '+[a.label,a.selected?'Yes':'No',a.assignedOwner||'Not supplied'].map(safeMd).join(' | ')+' |'),'',
    `Component network attachment IDs: ${c.attachmentIds.map(safeMd).join(', ')||'None supplied'}.`,''
  ]),...plan.findings.map(f=>'- '+f.code+': '+safeMd(f.message)),''].join('\n')
}
export function managementProductMarkdown(project:Project,includeInputs=true):string{
  const plan=managementProductPlan(project)
  return ['## Management roles and dependencies','',plan.meaning,'',...plan.components.flatMap(c=>[
    '### '+safeMd(c.name),'',`Product: ${c.product}; role: ${safeMd(c.role)||'Not selected'}; configuration requested: ${c.configurationRequested?'yes':'no'}.`,'',
    ...(includeInputs?[answerTable(project,productFields[c.product],project.components.find(row=>row.id===c.componentId)!.productDetails),'']:[]),...c.findings.map(f=>'- '+f.code+': '+safeMd(f.message)),...c.sources.map((url,i)=>'- [Product reference '+(i+1)+']('+url+')'),''
  ])].join('\n')
}
export function omeMarkdown(project:Project):string{
  const plan=omePlan(project)
  return ['## OME capacity and manual acceptance','',plan.meaning,'',...plan.appliances.flatMap(a=>[
    '### '+safeMd(a.name),'',a.vendor?'Vendor requirement: '+a.vendor.cores+' cores; '+a.vendor.memoryGB+' GB memory; '+a.vendor.primaryGB+' + '+a.vendor.secondaryGB+' GB disks.':'Sizing requires review.',
    a.required?'Reviewed allocation minimum: '+a.required.vCpu+' vCPU; '+a.required.memoryGiB+' GiB memory; '+a.required.primaryDiskGiB+' + '+a.required.secondaryDiskGiB+' GiB disks.':'No reviewed GiB conversion.',
    '','| Manual milestone | State | Owner | Evidence | UTC observation |','| --- | --- | --- | --- | --- |',...a.milestones.map(m=>'| '+[m.label,m.state,m.owner,m.evidence,m.observedAt].map(safeMd).join(' | ')+' |'),'',...a.findings.map(f=>'- '+f.code+': '+safeMd(f.message)),''
  ])].join('\n')
}
export function supportMarkdown(project:Project):string{
  const plan=supportPlan(project)
  return ['## Product and architecture support references','','Catalog '+plan.catalogVersion+'; reviewed '+plan.reviewedAt+'.',plan.meaning,'',...plan.rows.flatMap(row=>['### '+safeMd(row.targetName)+': '+safeMd(row.entry.topic),'','Baseline: '+safeMd(row.entry.baseline)+'; status: '+row.entry.status+'; basis: '+row.entry.basis+'.',safeMd(row.entry.summary),'',...row.entry.conditions.map(c=>'- '+safeMd(c)),...row.entry.sources.map((url,i)=>'- [Source '+(i+1)+']('+url+')'),'']),'Review the selected product and architecture versions against these references.'].join('\n')
}

function managementRows(project:Project):string[][]{const plan=project.managementPlan;return [...Object.entries(managementQuestions).map(([key,label])=>[label,plan.answers[key as keyof typeof managementQuestions]==='yes'?'Yes':plan.answers[key as keyof typeof managementQuestions]==='no'?'No':'Unanswered']),['Bare-metal OS deployment owner',plan.deploymentOwner?deploymentOwners[plan.deploymentOwner]:'Not selected'],...Object.entries(managementDecisionLabels).map(([key,label])=>[label,plan[key as keyof typeof managementDecisionLabels]||'Not specified'])]}
export function managementAdviceMarkdown(project:Project):string{
  const advice=managementAdvice(project)
  return ['## Management decisions and rationale','',advice.meaning,'','| Decision | Answer |','| --- | --- |',...managementRows(project).map(([key,value])=>'| '+safeMd(key)+' | '+safeMd(value)+' |'),'',...advice.options.flatMap(option=>['### '+option.name+' — '+option.status,'',...option.rationale.map(text=>'- '+safeMd(text)),...option.sources.map((url,i)=>'- [Capability source '+(i+1)+']('+url+')'),'']),'### Design reviews','',...advice.reviews.map(text=>'- '+safeMd(text)),...advice.findings.map(f=>'- '+f.code+': '+safeMd(f.message)),'','### Commercial review','',...advice.commercialReview.map(text=>'- '+safeMd(text)),''].join('\n')
}

export function vmmProfileMarkdown(project: Project): string {
  const plan = vmmProfilePlan(project)
  const lines = ['## VMM physical-profile creation handoff', '', `Status: ${plan.status}. Operator handoff; runtime qualification pending.`, '', ...plan.steps.map((s,i)=>`${i+1}. ${s}`), '']
  for (const target of plan.targets) {
    lines.push(`### ${safeMd(target.name)}`, '', `Design ID: ${safeMd(target.id)} · owner: ${safeMd(target.owner)} · host references: ${target.hostIds.map(safeMd).join(', ') || 'None assigned'}`, '', '| Input group | Reviewed values |', '| --- | --- |')
    for (const [key,value] of Object.entries(target).filter(([key])=>!['id','name','owner','hostIds'].includes(key))) lines.push(`| ${safeMd(key)} | ${safeMd(typeof value === 'object' ? JSON.stringify(value) : value)} |`)
    lines.push('')
  }
  lines.push(...plan.findings.map(f=>`- **${f.severity} — ${f.code}:** ${safeMd(f.message)}`), '', 'Creation remains separate from host submission. See handoffs/vmm-profiles/README.md for console steps and cmdlet parameter mappings.', '', ...plan.sources.urls.map(url=>`- [Microsoft reference](${url}) (reviewed ${plan.sources.reviewedAt})`), '')
  return lines.join('\n')
}

export function licensingMarkdown(project:Project):string {
  const plan=licensingPlan(project)
  return ['## Licensing quantities and purchase gaps','',`Assessment date ${plan.asOf}; rule profile ${plan.rules.id} ${plan.rules.version}, reviewed ${plan.rules.reviewedAt}.`,'',
    '| Item | Core licenses | Required units | Covered units | Purchase units | Unit basis | Estimate |','| --- | --- | --- | --- | --- | --- | --- |',
    // Coverage is listed after the quantity table so its links never look like additional billable items.
    ...plan.rows.map(r=>`| ${safeMd(r.name)} | ${r.calculationModel==='manual'?'Manual':r.coreLicenses??'Review'} | ${r.required??'Review'} | ${r.covered} | ${r.purchaseUnits??'Review'} | ${safeMd(licenseUnitLabel(r.unitBasis))} | ${r.estimatedCost===null?'Quote / basis review':`${safeMd(r.currency)} ${r.estimatedCost} / ${safeMd(r.term)}`} |`),'',
    ...plan.rows.flatMap(r=>[`### ${safeMd(r.name)}`,'',`Customer: ${safeMd(r.customerScope)||'Manual scope'} · quote: ${safeMd(r.quoteDate)||'Unresolved'} · source: ${safeMd(r.quoteSource)||'Unresolved'}`,'',`Rights owner: ${safeMd(r.commercial.rightsOwner)||'Unassigned'}. Program / term: ${safeMd(r.commercial.commercialProgram)} / ${safeMd(r.commercial.entitlementTerm)}. Assignment: ${safeMd(r.commercial.assignedAt)||'Unanswered'}.`,'',`Activation: ${safeMd(r.commercial.activation.method)||'Unanswered'}; ${r.commercial.activation.resolved?'prerequisites recorded':'review needed'}. Activation never establishes entitlement.`,'',...licensingRightsFields.map(f=>`- ${safeMd(f.label)}: ${safeMd(project.design.licenses.find(item=>item.id===r.id)!.values[f.key])||'Unanswered'}`),'',...r.details.map(d=>`- ${safeMd(JSON.stringify(d))}`),...r.reasons.map(s=>`- Unresolved: ${safeMd(s)}`),'']),
    '### Totals by currency and period','',...plan.totals.map(t=>`- ${safeMd(t.currency)} ${t.knownEstimate??'Review total'} / ${safeMd(t.term)} — ${t.rangeReview?'numeric range review required':t.complete?'all listed items priced':`partial; ${t.unresolvedItems} unresolved items`}`),'',...plan.assumptions.map(s=>`- ${s}`),'',...plan.rules.sources.map(url=>`- [Microsoft licensing guidance](${url})`),''].join('\n')
}

export function licenseCoverageMarkdown(project:Project):string{
  const plan=licensingPlan(project),coverage=plan.coverage
  return ['## Resource and supporting SQL coverage','',`${coverage.mapped.length} resource mappings; ${coverage.unmapped.length} resources still need coverage review. These mappings add no license quantities.`,'',
    '| License | Resource | Physical destination / basis | Scenario |','| --- | --- | --- | --- |',
    ...coverage.mapped.map(r=>`| ${safeMd(r.licenseName)} | ${safeMd(r.targetName)} | ${safeMd(r.physicalDestination||r.basis)} | ${safeMd(r.scenario)} |`),'',
    ...Object.entries(coverage.objects).flatMap(([key,rows])=>rows.length?[`### ${safeMd(key)}`,'',...rows.map(row=>`- ${safeMd(JSON.stringify(row))}`),'']:[]),
    '### Unmapped resources','',...coverage.unmapped.map(r=>`- ${safeMd(r.name)} (${safeMd(r.id)})`),'',
    '### Coverage findings','',...coverage.findings.map(f=>`- ${safeMd(f.code)}: ${safeMd(f.message)}`),
    ...plan.findings.filter(f=>f.code==='LICENSE_SQL_SUPPORTING_ESTATE').map(f=>`- ${safeMd(f.code)}: ${safeMd(f.message)}`),'',
    ...coverage.sources.urls.map(url=>`- [Microsoft licensing reference](${url}) (reviewed ${coverage.sources.reviewedAt})`),''].join('\n')
}

export function sdnMarkdown(project:Project):string{
 const plan=sdnPlan(project);if(!plan.active)return '## SDN design\n\nNo active SDN scope.\n'
 return ['## SDN design and setup contract','',`Delivery: ${plan.intentLabel}. Architecture: ${plan.architecture}; owner: ${plan.owner}. This report contains configuration data and an implementation checklist.`,'',answerTable(project,activeSdnFields(project.sdn),project.sdn.details),'','Controller template / procedure: '+(plan.controller.templateName||plan.controller.tool||'Not selected')+'. Expected controller VMs: '+(plan.controller.expectedVmCount??'Not selected')+'. VM hosting: '+(plan.controller.vmHostingAvailability||'Host cluster role')+'. See plans/sdn-controller.json for reviewed object/Run As mappings.','','### Role capacity','',...Object.entries(plan.capacity).map(([key,v])=>`- ${key}: ${v.records} records; ${v.vCpu} CPU allowance, ${v.memoryGiB} GiB RAM, ${v.diskGiB} GiB disk.`),'','### Ordered handoff','',...plan.stages.map(r=>`- ${r.order}. ${r.name}: ${safeMd(r.instruction)} Depends on: ${r.dependsOn.join(', ')||'none'}; targets: ${safeMd(r.targets.join(', '))||'fabric prerequisites'}; ${r.mode}; ${r.status}.`),'','### Acceptance scenarios','',...plan.acceptance.map(r=>`- ${r.id}: ${r.description}`),'',...plan.findings.map(f=>`- ${f.severity}: ${safeMd(f.message)}`),'',...plan.sources.map(url=>`- ${url}`),''].join('\n')
}
export function operationsMarkdown(project:Project):string{
  const plan=operationsPlan(project)
  return ['## Operations and recovery','',`Reviewed ${plan.reviewedAt}. Individual operator-reported tests do not establish current service health or native runtime qualification.`,'',...plan.recovery.map(r=>`- ${safeMd(String(r.inputs.name))}: ${safeMd(r.state)} at ${safeMd(String(r.inputs.observedAt)||'No observation')}; RTO ${r.rtoMet===null?'not established':r.rtoMet?'met in this test':'missed in this test'}; RPO ${r.rpoMet===null?'not established':r.rpoMet?'met in this test':'missed in this test'}.`),'',...plan.findings.map(f=>`- ${f.severity}: ${safeMd(f.message)}`),'',...plan.sources.map(url=>`- ${url}`),''].join('\n')
}

export function sdnServicesMarkdown(project:Project):string{
 const plan=sdnServices(project)
 const lines=['# SDN tenant services','','Tenant children inherit the selected service lifecycle and native owner; gateway pools declare their own lifecycle and owner. This is a design handoff, not an executable or runtime-qualified payload.','']
 if(!plan.active)return lines.concat('No active SDN scope.').join('\n')
 for(const c of sdnServiceCollections){lines.push(`## ${c.title}`,'');for(const row of plan.objects[c.key]||[])lines.push(`### ${safeMd(row.values.name)}`,'',answerTable(project,c.fields,row.values),'')}
 lines.push('## Gateway throughput budget','','| Pool | Members | Reserve | Available Mbps | Requested Mbps | Headroom Mbps |','| --- | --- | --- | --- | --- | --- |',...plan.capacity.map(r=>`| ${safeMd(r.name)} | ${r.members} | ${r.reserve} | ${r.availableMbps??'Unknown'} | ${r.requestedMbps??'Unknown'} | ${r.headroomMbps??'Unknown'} |`),'','Budget uses declared per-pool throughput and the sum of max(inbound, outbound) requests. Validate simultaneous traffic and failure behavior in the target environment.','','## Findings','',...plan.findings.map(f=>`- **${f.code}:** ${safeMd(f.message)}`),'',`Primary references reviewed ${plan.reviewedAt}:`,'',...plan.sources.map((url,i)=>`- [SDN reference ${i+1}](${url})`),'')
 return lines.join('\n')
}
export function networkMarkdown(project:Project):string{
  const plan=networkDesign(project)
  return ['## Host network design','',`Reviewed ${plan.reviewedAt}. Design only; runtime qualification remains pending.`,'',...plan.controls.qos.map(q=>`- Host ${safeMd(q.hostName)}: ${q.classCount} traffic classes; ${q.etsBandwidthPercent}% ETS reservation; ${q.priorityCount}/8 priorities assigned.`),'',...plan.pools.map(p=>`- ${safeMd(p.name)} (${safeMd(p.routingScope)}): ${p.totalAddresses??'Unknown'} pool addresses; ${p.unavailableAddresses??'Unknown'} unavailable; ${p.remainingAddresses??'Unknown'} remaining.`),'',...plan.findings.map(f=>`- ${f.severity}: ${safeMd(f.message)}`),'',...plan.sources.map(url=>`- ${url}`),''].join('\n')
}
export function storageMarkdown(project: Project): string {
  const plan = storagePlan(project)
  const lines = ['## Storage capacity review', '', 'Design estimates; no storage provisioning or runtime qualification has occurred.', '']
  for (const s of plan.systems) {
    lines.push(`### ${safeMd(s.name)}`, '', `${s.volumeCount} volumes; ${s.csvCount} CSV paths; ${s.fixedCount} fixed; ${s.thinCount} thin.`, '',
      '| Measure | Capacity |', '| --- | --- |',
      ...Object.entries({ 'Usable after logical reserve':s.availableTiB,'Expected data':s.consumedTiB,'Committed logical demand':s.committedTiB,'Remaining logical capacity':s.headroomTiB,'All volumes at full size':s.logicalTiB,'Remaining at full growth':s.fullGrowthHeadroomTiB,
        ...(s.kind==='s2d'?{'Capacity-drive inventory':s.inventoryRawTiB,'Physical repair allowance':s.repairReserveTiB,'Estimated raw committed footprint':s.rawCommittedTiB,'Estimated raw remaining':s.rawHeadroomTiB}:{})
      }).map(([key,value])=>`| ${key} | ${capacityText(value)} |`), '')
  }
  lines.push('### Disk placement within volume budgets', '', '| Volume | Lifecycle | Directories | SAN I/O paths | Mapped GiB | Unallocated GiB |', '| --- | --- | --- | --- | --- | --- |', ...plan.placement.volumes.map(v=>`| ${safeMd(v.name)} | ${safeMd(v.lifecycle)} | ${v.directoryCount} | ${v.ioPathCount} | ${v.allocatedGiB} | ${v.unallocatedGiB} |`), '', '### Resource disk coverage', '', '| Resource | Required GiB | Mapped GiB | Unmapped GiB |', '| --- | --- | --- | --- |', ...plan.placement.resources.map(r=>`| ${safeMd(r.name)} | ${r.sizeGiB} | ${r.mappedGiB} | ${r.unmappedGiB} |`), '')
  lines.push('### Assumptions', '', ...plan.assumptions.map(a=>`- ${a}`), '', '### Storage findings', '', ...plan.findings.map(f=>`- **${f.code}:** ${safeMd(f.message)}`), '', `Sources reviewed ${plan.review.reviewedAt}:`, '', ...plan.review.sources.map((url,i)=>`- [Microsoft storage reference ${i+1}](${url})`), '')
  const readiness=storageReadiness(project)
  lines.push('### Physical storage eligibility and ownership','',`Physical drive groups: ${readiness.disks.length}; storage interfaces: ${readiness.interfaces.length}; SAN routes: ${readiness.routes.length}. Operator input; runtime qualification remains pending.`,'','| Drive group | Host | Review |','| --- | --- | --- |',...readiness.disks.map(d=>`| ${safeMd(d.inputs.name)} | ${safeMd(d.hostId)} | ${d.status} |`),'')
  if(readiness.systems.some(s=>s.cacheMemory.length))lines.push('### S2D cache metadata memory','','Additional to OS, VM and application memory. Decimal TB and GB.','','| Host | Cache TB | Additional memory GB |','| --- | --- | --- |',...storageMetadataSchedule(project).map(m=>`| ${safeMd(m.Host)} | ${m.CacheDecimalTB.toFixed(3)} | ${m.AdditionalMetadataDecimalGB.toFixed(3)} |`),'')
  return lines.join('\n')
}

export function implementationMarkdown(project: Project): string {
  const lines = ['# Implementation handoff', '', 'Review this plan against the target environment and supported product versions before execution.', '',
    readinessMarkdown(project),
    '1. Confirm ownership, entitlement, topology support and explicit target scope.',
    '2. Prepare physical networking, storage presentation, identity, certificates and verified media.',
    '3. Establish an independent management bootstrap path.',
    '4. Provision selected hosts or preserve the existing hosts as designed; validate registration and connectivity.',
    '5. Configure the selected cluster, storage and host networking using the assigned single owner.',
    '6. Install/configure selected management components using supported dependencies and availability topology.',
  ]
  if (project.components.some(c => c.product === 'ome')) lines.push('7. Manually import and initialize OME; validate licensing, discovery, catalogs and selected integrations.')
  if(project.sdn.scope!=='none')lines.push(sdnMarkdown(project),sdnEvidenceMarkdown(project))
  lines.push('', '## Assigned stages', '')
  const plan = stagePlan(project)
  lines.push('Stage waves follow explicit prerequisite links. An entered stage number does not override its dependencies. Reported completion is an operator observation, not independently verified runtime evidence.', '',
    '| Stage | Reported state | Handoff disposition |', '| --- | --- | --- |', ...plan.stages.map(s => `| ${safeMd(s.name)} | ${safeMd(s.reportedState)} | ${s.disposition} |`), '')
  for (const [index, wave] of plan.waves.entries()) lines.push(`- Wave ${index + 1}: ${wave.map(id => safeMd(plan.stages.find(s => s.id === id)!.name)).join('; ')}`)
  lines.push('', ...plan.findings.map(f => `- **${f.code}:** ${safeMd(f.message)}`), '')
  if (vmmProfilePlan(project).status !== 'not-selected') lines.push(vmmProfileMarkdown(project))
  for (const row of [...project.design.stages].sort((a, b) => Number(a.values.order) - Number(b.values.order) || a.id.localeCompare(b.id))) {
    lines.push(`### ${safeMd(row.values.name)}`, '', ...Object.entries(row.values).map(([key, value]) => `- ${safeMd(key)}: ${safeMd(value) || 'Not specified'}`), '')
  }
  return lines.join('\n')
}

export function discoveryMarkdown(project:Project):string {
  const plan=driftPlan(project)
  return ['# Discovery and drift review','','Unsigned operator evidence; input hashes identify bytes, not authenticity. No infrastructure changes are performed.','',
    '| Target | Field | Designed | Observed | Status | Decision |','| --- | --- | --- | --- | --- | --- |',
    ...plan.rows.map(r=>`| ${safeMd(r.name)} | ${safeMd(r.field)} | ${safeMd(r.desired)} | ${safeMd(r.observed)} | ${safeMd(r.blockingReason||r.status)} | ${r.reviewCurrent?r.review!.decision:'Unreviewed or stale'} |`),'',
    '## Source provenance','',...project.discovery.snapshots.flatMap(e=>[`- ${safeMd(e.fileName)}: ${safeMd(e.snapshot.source.provider)} / ${safeMd(e.snapshot.source.endpoint)}; collector ${safeMd(e.snapshot.source.collector)} ${safeMd(e.snapshot.source.version)}; collected ${e.snapshot.collectedAt}; imported ${e.importedAt}; SHA-256 ${e.sha256}.`]),'',
    '## Review history','',...plan.reviews.map(r=>`- ${safeMd(r.targetId)} / ${safeMd(r.field)}: ${r.decision}; ${safeMd(r.reviewer)} at ${r.reviewedAt}; ${safeMd(r.reason)}.`),'',...plan.limitations.map(s=>`- ${s}`),''].join('\n')
}

function workbook(project: Project) {
  const book = XLSX.utils.book_new()
  const readiness=projectReadiness(project)
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{Design:readiness.designState,Runtime:readiness.runtimeState,DeploymentVerified:'No',Errors:readiness.counts.errors,Reviews:readiness.counts.reviews,MissingInputs:readiness.counts.missingInputs}]),'Project readiness')
  const schedules=designSchedules(project)
  for(const [key,title]of [['networks','IP and VLAN plan'],['addresses','Address allocations'],['ports','NIC and physical ports'],['interfaces','Host interface mappings'],['storage','Storage owner mappings'],['dependencies','Dependency relationships']]as const)XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(schedules[key]),title)
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(storageMetadataSchedule(project)),'S2D metadata memory')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(networkPoolSchedule(project)),'Network pool capacity')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(networkQosSchedule(project)),'Host QoS budget')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(operationsRecoverySchedule(project)),'Recovery objective results')
  const sdn=sdnPlan(project)
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(project.sdnEvidence.entries.flatMap(e=>e.evidence.results.map(r=>({Import:e.evidence.id,Result:r.id,Scenario:r.scenario,Targets:r.targetIds.join(', '),Status:r.status,Expected:r.expected,Observed:r.observed,Artifact:r.evidenceRef,SHA256:e.sha256})))),'SDN evidence results')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdnEvidenceAssessment(project).scenarios.map(r=>({Scenario:r.id,Status:r.status,Targets:r.targetIds.join(', '),Missing:r.missingTargets.join(', '),Results:r.resultIds.join(', ')}))),'SDN evidence coverage')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdnEvidenceAssessment(project).history.map(r=>({ID:r.id,File:r.fileName,SHA256:r.sha256,ObservedAt:r.observedAt,ImportedAt:r.importedAt,ScopeMatches:r.scopeMatches,Operator:r.source.operator,Runner:r.source.runner,Version:r.source.version}))),'SDN evidence history')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdn.active?activeSdnFields(project.sdn).map(f=>({Parameter:f.label,Value:renderAnswer(project,f,project.sdn.details[f.key])})):[]),'SDN fabric parameters')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdnServices(project).capacity.map(r=>({...r,availableMbps:r.availableMbps??'Unknown',requestedMbps:r.requestedMbps??'Unknown',headroomMbps:r.headroomMbps??'Unknown'}))),'SDN gateway capacity')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdn.stages.map(r=>({Stage:r.name,Order:r.order,Owner:r.owner,DependsOn:r.dependsOn.join(', '),Targets:r.targets.join(', '),Instruction:r.instruction,Mode:r.mode,Status:r.status,ExecutionAllowed:r.executionAllowed}))),'SDN setup stages')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdn.active?Object.entries(sdn.capacity).map(([Category,v])=>({Category,...v})):[]),'SDN role capacity')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(sdn.acceptance),'SDN acceptance scenarios')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(storageReadiness(project).disks.map(d=>({Drive:d.inputs.name,DriveId:d.id,HostId:d.hostId,Connection:d.inputs.bus,Presentation:d.inputs.presentation,Eligibility:d.status,ObservedAt:d.inputs.observedAt,Evidence:d.inputs.evidence,RuntimeQualified:'No'}))),'Physical storage review')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(hostDeploymentSchedule(project)),'Host deployment')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(prerequisiteSchedule(project)),'Prerequisite evidence')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(availabilityPlan(project).groups.filter(g=>g.details.sql.status!=='not-applicable').map(g=>({Group:g.name,GroupId:g.groupId,Status:g.details.sql.status,Databases:g.details.sql.databaseCount,Replicas:g.details.sql.replicaCount,AutomaticCandidates:g.details.sql.automaticCandidates,RuntimeSynchronized:'Not established'}))),'SQL availability')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(availabilityPlan(project).groups.map(g=>({Group:g.name,GroupId:g.groupId,Strategy:g.strategy,VotingStatus:g.voting.status,TotalVotes:g.voting.totalVotes??'Unknown',RequiredVotes:g.voting.requiredVotes??'Unknown',WorstRemainingVotes:g.voting.worstRemainingVotes??'Unknown',WorstRemainingWorkers:g.voting.worstRemainingWorkers??'Unknown',RuntimeQualified:'No'}))),'Availability voting')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(omissionSummary(project).components.map(c=>({Component:c.name,ComponentId:c.componentId,Product:products[c.product],PreviousLifecycle:c.priorLifecycle,Reason:c.reason,ReviewOwner:c.reviewOwner,OmittedAt:c.omittedAt,IncludedInActiveCapacity:'No'}))),'Omitted components')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(hostingPlan(project).components.flatMap(c=>c.actions.map(a=>({Component:c.name,ComponentId:c.componentId,Hosting:c.hosting,Lifecycle:c.lifecycle,ExistingResourceId:c.resourceId,Action:a.label,Selected:a.selected,Owner:a.assignedOwner,ExecutionReady:'No'})))),'Component action owners')
  const roles=managementProductPlan(project)
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(roles.components.map(c=>({Component:c.name,ComponentId:c.componentId,Product:c.product,Role:c.role||'Not selected',Version:c.version,Lifecycle:c.lifecycle,Hosting:c.hosting,ConfigurationRequested:c.configurationRequested,RuntimeQualified:'No',UnresolvedInputs:c.findings.length}))), 'Management roles')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(project.components.filter(c=>c.product!=='ome').flatMap(c=>productFields[c.product].map(f=>({Component:c.name,ComponentId:c.id,Product:c.product,Field:f.label,Value:renderAnswer(project,f,c.productDetails[f.key])})))), 'Product configuration')
  const ome=omePlan(project)
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(ome.appliances.map(a=>({Appliance:a.name,ComponentId:a.componentId,Profile:a.profile,VendorCores:a.vendor?.cores??'Review',VendorMemoryGB:a.vendor?.memoryGB??'Review',VendorPrimaryGB:a.vendor?.primaryGB??'Review',VendorSecondaryGB:a.vendor?.secondaryGB??'Review',MinimumMemoryGiB:a.required?.memoryGiB??'Review',AllocatedMemoryGiB:a.allocated.memoryGiB,AllocatedDiskGiB:a.allocated.diskGiB,Installation:a.installation,RuntimeQualified:'No'}))),'OME capacity')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(ome.appliances.flatMap(a=>a.milestones.map(m=>({Appliance:a.name,ComponentId:a.componentId,Milestone:m.label,State:m.state,Owner:m.owner,Evidence:m.evidence,ObservedAt:m.observedAt,Verification:m.verification})))),'OME manual acceptance')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(managementRows(project).map(([Decision,Answer])=>({Decision,Answer}))),'Management decisions')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(supportPlan(project).rows.map(row=>({Target:row.targetName,TargetId:row.targetId,Topic:row.entry.topic,Baseline:row.entry.baseline,Status:row.entry.status,Basis:row.entry.basis,Summary:row.entry.summary,Conditions:row.entry.conditions.join('; '),Sources:row.entry.sources.join('\n'),CatalogVersion:SUPPORT_CATALOG.version,ReviewedAt:SUPPORT_CATALOG.reviewedAt}))),'Support references')
  XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([['Project name',project.name],['Design owner',project.owner],['Scope',scopes[project.scope]],...contextRows(project)].map(([Decision,Value])=>({Decision,Value}))),'Project context')
  const management = project.components.map(c => ({ Name: c.name, Product: products[c.product], Lifecycle: c.lifecycle, Hosting: c.hosting, Placement: c.placement, Owner: c.owner, vCPU: c.vCpu, MemoryGiB: c.memoryGiB, DiskGiB: c.diskGiB, Installation: c.product === 'ome' ? 'Manual appliance deployment' : 'Per selected stage' }))
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(driftRows(project).map(r=>({Target:r.name,Field:r.field,Designed:r.desired,Observed:r.observed,Status:r.status,Reason:r.blockingReason,Decision:r.reviewCurrent?r.review!.decision:'Unreviewed or stale',Source:r.source,CollectedAt:r.collectedAt,SHA256:r.sha256}))), 'Discovery drift')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(management), 'Management')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(storageSchedule(project)), 'Storage capacity')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(storagePlan(project).placement.volumes), 'Disk placement')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(storagePlan(project).placement.resources), 'Disk coverage')
  for (const c of collections) {
    if (!collectionApplies(c, project)) continue
    const rows = project.design[c.key].map(row => Object.fromEntries([['Record ID', row.id], ...recordFields(project, c, row.values).map(field => [field.label, renderAnswer(project, field, row.values[field.key])])]))
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), c.key.slice(0, 31))
  }
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(allActiveDecisionFields(project).map(f => ({ Decision: f.label, Answer: renderAnswer(project, f, project.decisions[f.key]) || 'Unanswered' }))), 'Component decisions')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(validate(project)), 'Validation')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(licenseSummary(project).map(({details:_details,reasons,...row})=>({...row,reasons:reasons.join('\n')}))), 'Purchase gaps')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(licenseAssignmentSchedule(project)), 'License calculations')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(licensingPlan(project).totals), 'License totals')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(licensingPlan(project).coverage.mapped), 'Resource license coverage')
  return book
}

function pdf(project: Project): jsPDF {
  const document = new jsPDF()
  let y = 18
  const paragraph = (text: string, heading = false) => {
    if (heading && y > 200) { document.addPage(); y = 18 }
    document.setFont('helvetica', heading ? 'bold' : 'normal'); document.setFontSize(heading ? 13 : 9)
    document.setTextColor(heading ? '#153a50' : '#334f63')
    for (const line of document.splitTextToSize(text, 180) as string[]) {
      if (y > 270) { document.addPage(); y = 18 }
      document.text(line, 15, y); y += heading ? 7 : 4.5
    }
    y += 4
  }
  const table = (rows: string[][]) => {
    if (y > 240) { document.addPage(); y = 18 }
    autoTable(document, { startY: y, head: [['Decision', 'Value']], body: rows, margin: { top: 18, bottom: 20, left: 15, right: 15 }, styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' }, headStyles: { fillColor: [13, 99, 121] }, columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 125 } } })
    y = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 10
  }
  const answers = (fields: Field[], values: Answers) => table(fields.filter(f => visibleField(f, values)).map(f => [f.label, renderAnswer(project, f, values[f.key]) || 'Not specified']))
  paragraph(project.name || 'Hyper-V design', true)
  paragraph(`Revision ${project.revision} | Configurator ${metadata.version} | Owner: ${project.owner || 'Not specified'}`)
  paragraph(`${scopes[project.scope]} | ${project.environment}. Design handoff; infrastructure has not been deployed by this tool.`)
  const readiness=projectReadiness(project)
  paragraph('Project readiness',true);table([['Design',readiness.designState],['Runtime observations',readiness.runtimeState],['Deployment verified','No'],['Errors / reviews / missing inputs',`${readiness.counts.errors} / ${readiness.counts.reviews} / ${readiness.counts.missingInputs}`]])
  const total = componentTotals(project)
  paragraph('Project context',true);paragraph(scopeDescription(project));table(contextRows(project))
  paragraph('Management and SDN capacity', true)
  table([['Instances', String(total.instances)], ['vCPU / host CPU allowance', String(total.vCpu)], ['Memory (GiB)', String(total.memoryGiB)], ['Disk (GiB)', String(total.diskGiB)]])
  const availability=availabilityPlan(project)
  const prerequisite=prerequisitePlan(project)
  const hostDeployment=hostDeploymentPlan(project)
  if(hostDeployment.hosts.length){paragraph('Host deployment review',true);paragraph(hostDeployment.meaning);table(hostDeploymentSchedule(project).map(h=>[h.Host,`Observed: ${h.ObservedState||'Unknown'}; OS: ${h.OsAction||'Unspecified'} (${h.OsOwner||'Unassigned'}); Hyper-V: ${h.HyperVRoleAction||'Unspecified'} (${h.HyperVRoleOwner||'Unassigned'}); Membership: ${h.ClusterAction||'Unspecified'} (${h.AdmissionOwner||'Unassigned'}); runtime unqualified.`]))}
  if(prerequisite.identities.length||prerequisite.media.length||prerequisite.arc.length){paragraph('Prerequisite evidence',true);paragraph(prerequisite.meaning);table(prerequisiteSchedule(project).map(r=>[r.Resource,`${r.Kind}; ${r.State}; runtime qualification pending`]))}
  if(availability.groups.length){paragraph('Availability role and voting assessment',true);paragraph(availability.meaning);for(const g of availability.groups){paragraph(g.name,true);table([['Strategy',String(g.strategy)],['Voting status',g.voting.status],['Declared / required votes',`${g.voting.totalVotes??'Unknown'} / ${g.voting.requiredVotes??'Unknown'}`],['Worst remaining votes / workers',`${g.voting.worstRemainingVotes??'Unknown'} / ${g.voting.worstRemainingWorkers??'Unknown'}`],['Runtime qualification','Pending']]);for(const a of g.voting.assumptions)paragraph(a)}}
  for(const g of availability.groups){if(g.details.placement.sharedHosts.length)paragraph(`${g.name}: ${g.details.placement.sharedHosts.length} shared physical-host mappings correlate member failures.`);if(g.details.sql.status!=='not-applicable'){paragraph(g.name+' / SQL availability',true);table([['Design status',g.details.sql.status],['Protected databases',String(g.details.sql.databaseCount)],['SQL members',String(g.details.sql.replicaCount)],['Synchronous automatic candidates',String(g.details.sql.automaticCandidates)],['Runtime synchronization','Not established']])}}
  paragraph('Management requirements', true)
  table(Object.entries(project.requirements).map(([key, value]) => [key, value ? 'Yes' : 'No']))
  paragraph('Management decisions and rationale',true);table(managementRows(project))
  const advice=managementAdvice(project);paragraph(advice.meaning)
  for(const option of advice.options){paragraph(option.name+' / '+option.status,true);for(const reason of option.rationale)paragraph(reason);for(const source of option.sources)paragraph(source)}
  for(const note of [...advice.reviews,...advice.commercialReview])paragraph(note)
  if (project.design.storageSystems.length) {
    // Keep the storage heading and new memory-table introduction with its first row.
    if(y>195){document.addPage();y=18}
    paragraph('Storage capacity review', true)
    const metadataMemory=storageMetadataSchedule(project)
    if(metadataMemory.length){paragraph('S2D cache metadata memory',true);paragraph('Additional to OS, VM and application memory; decimal TB and GB.');table(metadataMemory.map(m=>[m.Host,`${m.CacheDecimalTB.toFixed(3)} TB cache; ${m.AdditionalMetadataDecimalGB.toFixed(3)} GB additional metadata memory.`]))}
    for (const s of storagePlan(project).systems) {
      paragraph(`${s.name}: ${s.volumeCount} volumes, ${s.csvCount} CSV paths, ${s.fixedCount} fixed, ${s.thinCount} thin`, true)
      table([['Usable after logical reserve',capacityText(s.availableTiB)],['Expected data',capacityText(s.consumedTiB)],['Committed logical demand',capacityText(s.committedTiB)],['Remaining logical capacity',capacityText(s.headroomTiB)],['All volumes at full size',capacityText(s.logicalTiB)],['Remaining at full growth',capacityText(s.fullGrowthHeadroomTiB)],
        ...(s.kind==='s2d'?[['Capacity-drive inventory',capacityText(s.inventoryRawTiB)],['Physical repair allowance',capacityText(s.repairReserveTiB)],['Estimated raw committed footprint',capacityText(s.rawCommittedTiB)],['Estimated raw remaining',capacityText(s.rawHeadroomTiB)]]:[])])
    }
    const placement = storagePlan(project).placement
    paragraph('Disk placement within volume budgets', true)
    for (const v of placement.volumes) table([['Volume',v.name],['Lifecycle',v.lifecycle || 'Not selected'],['Storage directories / SAN I/O paths',`${v.directoryCount} / ${v.ioPathCount}`],['Mapped / unallocated GiB',`${v.allocatedGiB} / ${v.unallocatedGiB}`]])
    if (placement.resources.length) { paragraph('Resource disk coverage', true); for(const r of placement.resources) table([['Resource',r.name],['Required / mapped / unmapped GiB',`${r.sizeGiB} / ${r.mappedGiB} / ${r.unmappedGiB}`]]) }
    for (const assumption of storagePlan(project).assumptions) paragraph(assumption)
  }
  for (const c of project.components) {
    paragraph(c.name || products[c.product], true)
    table(Object.entries(c).filter(([key, value]) => typeof value !== 'object' && key !== 'id').map(([key, value]) => [key, String(value)]))
    answers(hostingFields, c.hostingDetails); answers(productFields[c.product], c.productDetails)
    if (c.product === 'ome') { paragraph('OME manual appliance deployment', true); table(Object.entries(c.ome).map(([key, value]) => [key, String(value) || 'Not specified'])) }
  }
  for(const a of omePlan(project).appliances){paragraph(a.name+' / OME capacity and manual acceptance',true);paragraph('Operator observations only; runtime qualification remains pending.');table([['Vendor sizing',a.vendor?`${a.vendor.cores} cores / ${a.vendor.memoryGB} GB / ${a.vendor.primaryGB} + ${a.vendor.secondaryGB} GB disks`:'Review required'],['Reviewed GiB allocation',a.required?`${a.required.memoryGiB} GiB memory / ${a.required.primaryDiskGiB} + ${a.required.secondaryDiskGiB} GiB disks`:'Review required']]);for(const m of a.milestones)table([['Milestone',m.label],['State / owner',m.state+' / '+m.owner],['Evidence / UTC',m.evidence+' / '+m.observedAt]])}
  const omissions=omissionSummary(project)
  if(omissions.components.length){paragraph('Omitted components',true);paragraph(omissions.meaning);for(const c of omissions.components)table([['Component / product',(c.name||c.componentId)+' / '+products[c.product]],['Previous lifecycle',c.priorLifecycle],['Omission reason',c.reason||'Review needed'],['Review owner',c.reviewOwner||'Review needed'],['Omitted at',c.omittedAt],['Active capacity and execution','Excluded']])}
  const support=supportPlan(project)
  if(support.rows.length){paragraph('Product and architecture support references',true);paragraph('Catalog '+support.catalogVersion+'; reviewed '+support.reviewedAt+'. '+support.meaning);for(const row of support.rows){table([['Target / topic',row.targetName+' / '+row.entry.topic],['Baseline / status',row.entry.baseline+' / '+row.entry.status+' ('+row.entry.basis+')'],['Scope',row.entry.summary],['Conditions',row.entry.conditions.join('\n')],['Sources',row.entry.sources.join('\n')]])}}
  const network=networkDesign(project)
  const operations=operationsPlan(project)
  if(operations.recovery.length){if(y>180){document.addPage();y=18}paragraph('Operations recovery objective results',true);paragraph('Individual operator-reported tests only. Planned or incomplete observations do not establish objective acceptance. Native runtime qualification remains pending.');for(const r of operationsRecoverySchedule(project))table([['Test / resource',r.Test+' / '+r.ResourceId],['Reported state / UTC',r.State+' / '+r.ObservedAt],['Measured recovery / data age (minutes)',`${r.DurationMinutes} / ${r.RecoveredDataAgeMinutes}`],['RTO / RPO met in this test',r.RtoMet+' / '+r.RpoMet],['Complete evidence / native qualification',r.EvidenceComplete+' / '+r.RuntimeQualified]])}
  if(network.controls.qos.length){paragraph('Host QoS budget',true);paragraph('One reservation per host class. Native and physical QoS acceptance remains pending.');for(const q of network.controls.qos)table([['Host',q.hostName],['Traffic classes / ETS reservation / priorities',`${q.classCount} / ${q.etsBandwidthPercent}% / ${q.priorityCount} of 8`]])}
  if(network.pools.length){if(y>225){document.addPage();y=18}paragraph('Host network address pool capacity',true);paragraph('Declared assignments, exclusions and gateways only. Undiscovered use and native runtime qualification remain pending.');for(const pool of network.pools)table([['Network / routing scope',pool.name+' / '+pool.routingScope],['Pool / unavailable / remaining addresses',`${pool.totalAddresses??'Unknown'} / ${pool.unavailableAddresses??'Unknown'} / ${pool.remainingAddresses??'Unknown'}`]])}
  paragraph('SDN architecture', true)
  table(Object.entries(project.sdn).filter(([key])=>key!=='details').map(([key, value]) => [key, String(value) || 'Not specified']))
  const sdn=sdnPlan(project)
  const evidenceReview=sdnEvidenceAssessment(project)
  if(sdn.active&&project.sdnEvidence.entries.length){paragraph('SDN acceptance evidence',true);paragraph('Review: '+evidenceReview.status+'. Unsigned operator observations; native qualification and setup status are unchanged.');for(const row of evidenceReview.scenarios)table([['Scenario',row.id],['Status',row.status],['Targets without passed observations',row.missingTargets.join(', ')||'None']]);for(const entry of project.sdnEvidence.entries){table([['Evidence import',entry.evidence.id],['Observed / imported',entry.evidence.observedAt+' / '+entry.importedAt],['Source SHA-256',entry.sha256],['Operator / runner / version',entry.evidence.source.operator+' / '+entry.evidence.source.runner+' / '+entry.evidence.source.version],['Source endpoint',entry.evidence.source.endpoint]]);for(const result of entry.evidence.results)table([['Scenario / result',result.scenario+' / '+result.id],['Status',result.status],['Targets',result.targetIds.join(', ')],['Expected',result.expected],['Observed',result.observed],['Artifact reference',result.evidenceRef]])}}
  if(sdn.active){paragraph('Controller template / procedure: '+(sdn.controller.templateName||sdn.controller.tool||'Not selected')+'. Expected VMs: '+(sdn.controller.expectedVmCount??'Unanswered')+'.');answers(activeSdnFields(project.sdn),project.sdn.details);paragraph('SDN delivery: '+sdn.intentLabel+'. Native execution remains unqualified.');for(const [kind,capacity]of Object.entries(sdn.capacity))table([['Capacity category',kind],['Records / CPU allowance / GiB memory / GiB disk',`${capacity.records} / ${capacity.vCpu} / ${capacity.memoryGiB} / ${capacity.diskGiB}`]]);for(const stage of sdn.stages)table([['SDN stage',stage.name],['Depends on',stage.dependsOn.join(', ')||'None'],['Owner / status',stage.owner+' / '+stage.status],['Instruction',stage.instruction]]);for(const test of sdn.acceptance)table([['Acceptance scenario',test.id],['Required evidence',test.description]])}
  paragraph('Component decisions', true); answers(allActiveDecisionFields(project), project.decisions)
  for (const collection of collections) {
    if (!collectionApplies(collection, project)) continue
    paragraph(collection.title, true)
    if (!project.design[collection.key].length) paragraph('No records supplied.')
    for (const row of project.design[collection.key]) { if(y>220){document.addPage();y=18}paragraph(String(row.values.name || collection.singular)); answers(recordFields(project,collection,row.values), row.values) }
  }
  if(project.design.licenses.length) {
    const plan=licensingPlan(project)
    paragraph('Licensing quantities and purchase gaps',true)
    paragraph(`Assessment ${plan.asOf}. Core rules reviewed ${plan.rules.reviewedAt}.`)
    for(const row of plan.rows)table([['License item',row.name],['Core licenses',row.calculationModel==='manual'?'Manual':String(row.coreLicenses??'Review')],['Required / covered / purchase units',`${row.required??'Review'} / ${row.covered} / ${row.purchaseUnits??'Review'}`],['Unit basis',licenseUnitLabel(row.unitBasis)],['Estimate',row.estimatedCost===null?'Quote / basis review needed':`${row.currency} ${row.estimatedCost} / ${row.term}`],['Quote date / evidence',`${row.quoteDate} / ${row.quoteSource}`]])
    const labels:Record<string,string>={LicenseItem:'License item',LicenseId:'License design reference',AssignmentId:'Assignment reference',TargetId:'Target design reference',TargetName:'Target',Model:'Calculation model',PhysicalCores:'Physical cores',BaseCores:'Core licenses per full set',LicenseSets:'Full license sets',CoreLicenses:'Core licenses',VirtualCores:'vCPU',PeakVirtualOSEs:'Peak virtual OSEs',CustomerMinimumTopUp:'Customer minimum top-up (cores)',PlacementReview:'Placement review'}
    for(const detail of licenseAssignmentSchedule(project))table(Object.entries(detail).filter(([,value])=>value!==null&&value!=='').map(([key,value])=>[labels[key]||key,key==='Model'?({host:'Physical server',vm:'Server VM','customer-minimum':'Customer pool minimum'} as Record<string,string>)[String(value)]||String(value):String(value)]))
    for(const total of plan.totals)paragraph(`${total.currency} ${total.knownEstimate??'Review total'} / ${total.term} — ${total.rangeReview?'numeric range review required':total.complete?'all listed items priced':`partial estimate; ${total.unresolvedItems} items unresolved`}`)
    for(const assumption of plan.assumptions)paragraph(assumption)
  }
  if (project.discovery.snapshots.length) {
    paragraph('Discovery and drift review', true)
    paragraph('Unsigned operator observations. Adoption changes the design only; reconcile decisions do not execute infrastructure changes.')
    table(project.discovery.snapshots.map(e=>[e.fileName,`${e.snapshot.source.provider} / ${e.snapshot.source.endpoint}; ${e.snapshot.source.collector} ${e.snapshot.source.version}. Collected ${e.snapshot.collectedAt}; imported ${e.importedAt}. SHA-256: ${e.sha256}`]))
    table(driftRows(project).map(r=>[`${r.name} / ${r.field}`,`Designed: ${r.desired}; observed: ${r.observed}. ${r.blockingReason||r.status}. Decision: ${r.reviewCurrent?r.review!.decision:'Unreviewed or stale'}. Collected: ${r.collectedAt}`]))
  }
  paragraph('Licensing purchase gaps', true)
  table(licenseSummary(project).map(item => [item.name, item.unresolved ? 'Agreement / licensing basis review needed' : `${item.purchaseUnits} purchase units; ${item.currency} ${item.estimatedCost} / ${item.term}`]))
  paragraph('Validation and unresolved decisions', true)
  table(validate(project).map(f => [`${f.severity.toUpperCase()} / ${f.code}`, f.message]))
  for (let page = 1; page <= document.getNumberOfPages(); page++) {
    document.setPage(page); document.setFontSize(8); document.setTextColor('#637688')
    document.text(`Hyper-V Configurator ${metadata.version} | Design handoff | ${page} / ${document.getNumberOfPages()}`, 15, 288)
  }
  return document
}

async function png(diagram:{svg:string;width:number;height:number}): Promise<Uint8Array> {
  const image = new Image(), url = URL.createObjectURL(new Blob([diagram.svg], { type: 'image/svg+xml' }))
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render topology.')); image.src = url })
    const canvas = document.createElement('canvas'); canvas.width = diagram.width; canvas.height = diagram.height
    const context = canvas.getContext('2d'); if (!context) throw new Error('PNG rendering is unavailable in this browser.')
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not export topology PNG.')), 'image/png'))
    return new Uint8Array(await blob.arrayBuffer())
  } finally { URL.revokeObjectURL(url) }
}

export function environmentFiles(project: Project): Record<string, string> {
  serializeProject(project)
  // Environment files carry only components in use: gated collections and hidden record fields are left out. project.json keeps everything.
  const group = (keys: string[]) => Object.fromEntries(keys.filter(key => { const c = collections.find(c => c.key === key); return !c || collectionApplies(c, project) }).map(key => {
    const hidden = decisionHiddenFields(project, key)
    return [key, hidden.size ? project.design[key].map(row => ({ ...row, values: Object.fromEntries(Object.entries(row.values).filter(([field]) => !hidden.has(field))) })) : project.design[key]]
  }))
  return {
    ...(vmmProfilePlan(project).status === 'not-selected' ? {} : {
      'handoffs/vmm-profiles/plan.json': JSON.stringify(vmmProfilePlan(project), null, 2),
      'handoffs/vmm-profiles/README.md': vmmProfileGuide,
      'reports/vmm-profile-creation.md': vmmProfileMarkdown(project),
    }),
    'plans/quorum-configuration.json':JSON.stringify(quorumConfiguration(project),null,2),
    'project.json': serializeProject(project),
    'infrastructure.yml': infrastructureYaml(project),
    'environment/network-devices.yml': yaml(group(networkDeviceKeys)),
    'plans/availability-assessment.json':JSON.stringify(availabilityPlan(project),null,2),
    'reports/availability-assessment.md':availabilityMarkdown(project),
    'plans/prerequisites.json':JSON.stringify(prerequisitePlan(project),null,2),
    'reports/prerequisites.md':prerequisiteMarkdown(project),
    'plans/host-deployment.json':JSON.stringify(hostDeploymentPlan(project),null,2),
    'reports/host-deployment.md':hostDeploymentMarkdown(project),
    'archive/omitted-components.yml':yaml({purpose:'Excluded configuration archive; not an execution input',components:project.omittedComponents}),
    'plans/component-omissions.json':JSON.stringify(omissionSummary(project),null,2),
    'reports/component-omissions.md':omissionMarkdown(project),
    'plans/component-hosting.json':JSON.stringify(hostingPlan(project),null,2),
    'reports/component-hosting.md':hostingMarkdown(project),
    'environment/component-networks.yml':yaml({attachments:project.design.managementNetworks}),
    'plans/management-products.json':JSON.stringify(managementProductPlan(project),null,2),
    'reports/management-products.md':managementProductMarkdown(project),
    'plans/management-advice.json':JSON.stringify(managementAdvice(project),null,2),
    'reports/management-advice.md':managementAdviceMarkdown(project),
    'catalogs/support.json':JSON.stringify(SUPPORT_CATALOG,null,2),
    'plans/support-baselines.json':JSON.stringify(supportPlan(project),null,2),
    'reports/support.md':supportMarkdown(project),
    'environment/scenario.yml': yaml({ kind: project.kind, schema_version: project.schemaVersion, id: project.id, name: project.name, revision: project.revision, scope: project.scope, owner: project.owner, environment: project.environment, context:project.context, deployment_state: 'not_executed_by_configurator' }),
    'environment/hardware.yml': yaml(group(['sites', 'clusters', 'hosts', 'profiles'])),
    'environment/storage.yml': yaml(group(['storageSystems', 'disks', 'volumes', 'storagePaths', 'storageAllocations', 'sanPaths', 'storageInterfaces'])),
    'plans/storage-assessment.json': JSON.stringify(storagePlan(project), null, 2),
    'plans/storage-readiness.json':JSON.stringify(storageReadiness(project),null,2),
    'reports/storage.md': storageMarkdown(project),
    'environment/networking.yml': yaml(group(['networks', 'adapters','hostSwitches','switchMembers','hostVnics','addressAssignments','networkTrafficClasses'])),
    'plans/network-design.json':JSON.stringify(networkDesign(project),null,2),
    'plans/network-controls.json':JSON.stringify(networkControlPlan(project),null,2),
    'reports/network-design.md':networkMarkdown(project),
    'environment/identity.yml': yaml(group(['identities', 'media','identityBindings','mediaBindings','securityPolicies'])),
    'environment/management.yml': yaml({ requirements: project.requirements, decisions:project.managementPlan, components: project.components.filter(c => c.product !== 'ome') }),
    'environment/availability.yml': yaml(group(['availabilityGroups', 'availabilityMembers', 'availabilityDatabases', 'dependencies'])),
    'plans/dependency-order.json': JSON.stringify({ kind: 'hyperv-dependency-order', schemaVersion: 1, projectId: project.id, projectRevision: project.revision, executionState: 'not_executed_by_configurator', phases: ['bootstrap', 'runtime', 'recovery'].map(phase => dependencyOrder(project, phase)), scope: 'Declared resource prerequisites only; this is not a runnable execution plan.' }, null, 2),
    'environment/ome.yml': yaml({ installation: 'manual', appliances: project.components.filter(c => c.product === 'ome'),plan:omePlan(project) }),
    'plans/ome-manual.json':JSON.stringify(omePlan(project),null,2),
    'reports/ome-manual.md':omeMarkdown(project),
    'environment/sdn.yml': yaml({ ...project.sdn, details:project.sdn.scope==='none'?{}:activeSdnDetails(project.sdn), ...(project.sdn.scope === 'none' ? {} : group(sdnCollectionKeys)) }),
    'environment/licensing.yml': yaml(group(['licenses','licenseAssignments',...licenseCoverageKeys,...licenseDependencyKeys])),
    'plans/license-coverage.json': JSON.stringify(licensingPlan(project).coverage,null,2),
    'reports/license-coverage.md': licenseCoverageMarkdown(project),
    'plans/licensing-assessment.json': JSON.stringify(licensingPlan(project),null,2),
    'reports/licensing.md': licensingMarkdown(project),
    'licensing/README.md': licensingGuide,
    'environment/operations.yml': yaml(group(['operations', 'operationsTargets','recoveryTests','capacityAlerts','securityPolicies','stages'])),
    'plans/operations.json':JSON.stringify(operationsPlan(project),null,2),
    'sdn/sdn-evidence.md':sdnEvidenceGuide.replace('(plans/implementation.md)','(https://gitlab.com/tierpoint/prodtech/hybrid-cloud/toolkits/configurators/-/blob/main/apps/hyperv-configurator/docs/plans/implementation.md)'),
    'sdn/acceptance-request.json':JSON.stringify(sdnAcceptanceRequest(project),null,2),
    'sdn/result-template.json':JSON.stringify(sdnEvidenceTemplate(project),null,2),
    'reports/sdn-evidence.json':JSON.stringify(sdnEvidenceAssessment(project),null,2),
    'reports/sdn-evidence.md':sdnEvidenceMarkdown(project),
    ...Object.fromEntries(project.sdnEvidence.entries.map((e,i)=>['sdn/evidence/source-'+(i+1)+'.json',e.original])),
    'plans/sdn-design.json':JSON.stringify(sdnPlan(project),null,2),
    'plans/sdn-controller.json':JSON.stringify(sdnPlan(project).controller,null,2),
    'plans/sdn-services.json':JSON.stringify(sdnServices(project),null,2),
    'reports/sdn-services.md':sdnServicesMarkdown(project),
    'reports/sdn-design.md':sdnMarkdown(project),
    'sdn/README.md':sdnGuide,
    'sdn/sdn-services.md':sdnServicesGuide.replace('(sdn-design.md)','(README.md)').replace('(plans/implementation.md)','(https://gitlab.com/tierpoint/prodtech/hybrid-cloud/toolkits/configurators/-/blob/main/apps/hyperv-configurator/docs/plans/implementation.md)'),
    'reports/operations.md':operationsMarkdown(project),
    'plans/stage-plan.json': JSON.stringify(stagePlan(project), null, 2),
    'discovery/snapshots.json': JSON.stringify(project.discovery, null, 2),
    'plans/drift-review.json': JSON.stringify(driftPlan(project), null, 2),
    'reports/discovery.md': discoveryMarkdown(project),
    'discovery/README.md': discoveryGuide,
    'reports/design.md': designMarkdown(project),
    'reports/high-level-design.md':designMarkdown(project),
    'reports/implementation-plan.md': implementationMarkdown(project),
    'reports/low-level-design.md':implementationMarkdown(project),
    'reports/bill-of-materials.csv':billOfMaterialsCsv(project),
    'plans/project-readiness.json':JSON.stringify(projectReadiness(project),null,2),
    'reports/project-readiness.md':readinessMarkdown(project),
    'validation/results.json': JSON.stringify({ designErrors: validate(project).filter(f => f.severity === 'error').length, packagePurpose: 'configuration-design', readiness:projectReadiness(project), findings: validate(project) }, null, 2),
    'validation/results.md':validationMarkdown(project),
    'plans/design-schedules.json':JSON.stringify(designSchedules(project),null,2),
    'diagrams/README.md':diagramsGuide,
    'diagrams/topology-graph.json': JSON.stringify(topology(project).graph,null,2),
    ...Object.fromEntries((Object.keys(topologyViews) as TopologyView[]).map(view=>[`diagrams/${view==='overview'?'topology':view}.drawio`,topology(project,view).drawio])),
  }
}

export async function exportPackage(project: Project) {
  const files: Record<string, string | Uint8Array> = environmentFiles(project)
  files['reports/design.pdf'] = new Uint8Array(pdf(project).output('arraybuffer'))
  const book = workbook(project)
  files['reports/inventory.xlsx'] = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))
  for (const name of book.SheetNames) {
    const safeSheet = structuredClone(book.Sheets[name])
    for (const [key, cell] of Object.entries(safeSheet)) {
      if (!key.startsWith('!') && typeof cell === 'object' && cell !== null && typeof cell.v === 'string' && /^[=+\-@\t\r]/.test(cell.v)) { cell.v = `'${cell.v}`; delete cell.w }
    }
    files[`reports/schedules/${name}.csv`] = XLSX.utils.sheet_to_csv(safeSheet)
  }
  const diagramIndex=[]
  for(const view of Object.keys(topologyViews) as TopologyView[]){const diagram=topology(project,view),base=view==='overview'?'topology':view;for(const [index,page]of diagram.pages.entries()){const path=`diagrams/${base}${index===0?'':'-'+String(index+1).padStart(3,'0')}.png`;files[path]=await png(page);diagramIndex.push({view,title:page.title,page:index+1,pages:diagram.pages.length,path,editable:`diagrams/${base}.drawio`,nodes:page.nodes.map(n=>n.id),edges:page.edges.map(e=>e.id),width:page.width,height:page.height,relationshipPage:page.relationshipPage})}}
  files['diagrams/index.json']=JSON.stringify({kind:'hyperv-diagram-index',version:'1.0.0',pages:diagramIndex},null,2)
  const manifests = await Promise.all(Object.keys(files).sort().map(async path => {
    const value = files[path], data = typeof value === 'string' ? new TextEncoder().encode(value) : value
    return { path, sizeBytes: data.length, sha256: await hash(data) }
  }))
  files['manifest.json'] = JSON.stringify({ schemaVersion: 1, generatorVersion: metadata.version, projectId: project.id, designRevision: project.revision, generatedAt: new Date().toISOString(), executionState: 'not_executed_by_configurator', readiness:projectReadiness(project), packagePurpose: 'configuration-design', files: manifests }, null, 2)
  const zip = new PizZip()
  for (const [path, value] of Object.entries(files)) zip.file(path, value, { date: new Date('2026-01-01T00:00:00Z') })
  download('hyperv-design.zip', zip.generate({ type: 'uint8array', compression: 'DEFLATE' }), 'application/zip')
}
export function exportMarkdown(project: Project) { download('hyperv-design.md', designMarkdown(project), 'text/markdown') }
export function exportPdf(project: Project) { serializeProject(project); download('hyperv-design.pdf', pdf(project).output('blob'), 'application/pdf') }
export function exportWorkbook(project: Project) { serializeProject(project); download('hyperv-inventory.xlsx', new Uint8Array(XLSX.write(workbook(project), { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') }

export function sdnEvidenceMarkdown(project:Project):string {
 const review=sdnEvidenceAssessment(project)
 return ['## SDN acceptance evidence','',`Review: ${review.status}. Scope SHA-256: ${review.scopeHash}.`,'','Unsigned operator observations; native execution remains unqualified and setup stages remain unchanged.','',...review.scenarios.map(r=>`- ${r.id}: ${r.status}; missing targets: ${r.missingTargets.map(safeMd).join(', ')||'none'}.`),'',...project.sdnEvidence.entries.flatMap(e=>[`### ${safeMd(e.evidence.id)}`,'',`Original file: ${safeMd(e.fileName)}; SHA-256: ${e.sha256}; observed: ${e.evidence.observedAt}; imported: ${e.importedAt}.`,...e.evidence.results.map(r=>`- ${safeMd(r.scenario)} / ${safeMd(r.id)}: ${r.status}; targets: ${r.targetIds.map(safeMd).join(', ')}. Expected: ${safeMd(r.expected)}. Observed: ${safeMd(r.observed)}. Artifact: ${safeMd(r.evidenceRef)}.`)]),''].join('\n')
}
