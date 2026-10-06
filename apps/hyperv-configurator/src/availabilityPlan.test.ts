import {it,expect} from 'vitest'
import {newProject,newComponent,serializeProject,parseProject,componentTotals,type Project} from './project'
import {collections,newRecord,type Answers} from './catalog'
import {availabilityPlan} from './availabilityPlan'
import {managementFindings} from './managementValidation'
import {sanitizeProject} from './sanitize'
import {removeAvailabilityV17} from './testing/legacyAvailabilityDetails'

function add(p:Project,key:string,values:Answers){const row=newRecord(collections.find(c=>c.key===key)!);Object.assign(row.values,values);p.design[key].push(row);return row}
function pool(count=2,role='management'){
  const p=newProject(),site=add(p,'sites',{name:'Primary site'})
  const group=add(p,'availabilityGroups',{name:'Monitoring pool',product:'scom',strategy:'resourcepool',minimumActive:1,failureDomainsLost:1,siteScope:'single',poolWorkload:'unix',defaultObserver:'disabled',poolLatencyMs:'2.5',poolQualification:'Reviewed pool and UNIX certificate distribution',drMode:'none',recoveryObjectivesEvidence:'Owner approves 30 minute service objective'})
  for(let i=0;i<count;i++){const c=newComponent('scom');c.name='Monitor '+i;c.version='2025';c.failureDomain='Rack '+i;Object.assign(c.productDetails,{role,managementGroup:'Example',resourcePools:'Monitoring pool'});p.components.push(c);add(p,'availabilityMembers',{group:group.id,component:c.id,role:'active',site:site.id})}
  return {p,group,site}
}
const codes=(p:Project)=>availabilityPlan(p).findings.map(f=>f.code)
it('requires a majority independently of the minimum surviving worker count',()=>{
  const {p}=pool();expect(availabilityPlan(p).groups[0].voting).toMatchObject({status:'insufficient',totalVotes:2,requiredVotes:2,worstRemainingVotes:1,worstRemainingWorkers:1});expect(codes(p)).toContain('SCOM_POOL_QUORUM')
})
it('models an explicit database observer and correlated domain loss',()=>{
  const {p,group,site}=pool(),sql=newComponent('sql');p.components.push(sql);Object.assign(group.values,{defaultObserver:'enabled',observerDatabase:sql.id,observerFailureDomain:'Independent database boundary',observerSite:site.id,observerEvidence:'SQL owner verifies correlated failures and availability'})
  expect(availabilityPlan(p).groups[0].voting).toMatchObject({status:'consistent',totalVotes:3,requiredVotes:2,worstRemainingVotes:2})
  group.values.observerFailureDomain=p.components[0].failureDomain;expect(availabilityPlan(p).groups[0].voting).toMatchObject({status:'insufficient',worstRemainingVotes:1})
})
it('does not invent a default database observer or grant it to gateways',()=>{
  const {p,group}=pool(3,'gateway');expect(availabilityPlan(p).groups[0].voting.status).toBe('consistent');group.values.defaultObserver='enabled';expect(codes(p)).toContain('SCOM_GATEWAY_OBSERVER');expect(availabilityPlan(p).groups[0].voting.status).toBe('unknown');group.values.defaultObserver='';expect(codes(p)).toContain('SCOM_DEFAULT_OBSERVER')
})
it('retains explicit voting-only observers without counting them as workers or new capacity',()=>{
  const {p,group,site}=pool(),observer=newComponent('scom');observer.version='2025';observer.failureDomain='Independent observer';Object.assign(observer.productDetails,{role:'management',managementGroup:'Example',resourcePools:'Observed pool'});p.components.push(observer);add(p,'availabilityMembers',{group:group.id,component:observer.id,role:'observer',site:site.id})
  expect(componentTotals(p).instances).toBe(3);expect(availabilityPlan(p).groups[0].voting).toMatchObject({status:'consistent',totalVotes:3,worstRemainingWorkers:1});group.values.minimumActive=2;expect(availabilityPlan(p).groups[0].voting.status).toBe('insufficient')
})
it('keeps unknown builds, duplicate memberships and wrong roles out of voting arithmetic',()=>{
  const {p}=pool(3);p.components[0].productDetails.role='reporting';expect(codes(p)).toContain('SCOM_POOL_ROLE');expect(availabilityPlan(p).groups[0].voting.status).toBe('unknown');p.components[0].productDetails.role='management';p.components[0].version='Future build';expect(codes(p)).toContain('SCOM_POOL_VERSION');p.components[0].version='2025';add(p,'availabilityMembers',{...p.design.availabilityMembers[0].values});expect(availabilityPlan(p).groups[0].voting.status).toBe('unknown')
})
it('rejects duplicate provider servers and conflicting member sites',()=>{
  const {p,group}=pool(3);p.components[0].hostingDetails.resourceId='vm-42';p.components[1].hostingDetails.resourceId='vm-42';expect(codes(p)).toContain('SCOM_POOL_DUPLICATE_SERVER');expect(availabilityPlan(p).groups[0].voting.status).toBe('unknown')
  const other=add(p,'availabilityGroups',{...group.values}),site=add(p,'sites',{name:'Other site'});add(p,'availabilityMembers',{group:other.id,component:p.components[0].id,role:'active',site:site.id});expect(codes(p)).toContain('HA_MEMBER_SITE_CONFLICT')
})
it('separates site recovery from a pool spanning datacenters and rejects Windows agent pool routing',()=>{
  const {p,group}=pool(3),site=add(p,'sites',{name:'Recovery site'});p.design.availabilityMembers[0].values.site=site.id;group.values.poolWorkload='windows';expect(codes(p)).toContain('SCOM_POOL_SITES');expect(codes(p)).toContain('SCOM_WINDOWS_AGENT_POOL');group.values.drMode='warm';expect(codes(p)).toContain('HA_DR_INPUT');Object.assign(group.values,{drSite:site.id,drDependencies:'Recover database before service activation',drAcceptance:'Record measured restore/failback'});expect(codes(p)).not.toContain('HA_DR_INPUT')
})
it('rejects VMM consoles and stretched service clusters while retaining separate SQL HA identity',()=>{
  const {p,group}=pool();group.values.product='vmm';group.values.strategy='servicecluster';group.values.siteScope='multiple';group.values.serviceClusterIdentity='Shared cluster';for(const c of p.components){c.product='vmm';c.productDetails=newComponent('vmm').productDetails;c.productDetails.role='console'}add(p,'availabilityGroups',{product:'sql',strategy:'sqlfci',serviceClusterIdentity:'SHARED CLUSTER'});const found=codes(p);for(const code of ['VMM_HA_ROLE','VMM_STRETCHED_SERVICE','VMM_HA_DATABASE_CLUSTER'])expect(found).toContain(code)
})
it('does not equate differing WAC modes with an HA pair',()=>{
  const {p,group}=pool();group.values.product='wac';group.values.strategy='custom';for(const [i,c]of p.components.entries()){c.product='wac';c.productDetails=newComponent('wac').productDetails;c.productDetails.mode=i?'virtualization':'administration'}expect(codes(p)).toContain('WAC_HA_MODES')
})
it('migrates real schema 15 fields without inventing observer or site answers',()=>{
  const {p,group}=pool(),old:any=JSON.parse(serializeProject(p));old.schemaVersion=15;expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 15');for(const row of old.design.availabilityGroups)for(const key of ['siteScope','serviceClusterIdentity','poolWorkload','defaultObserver','observerDatabase','observerFailureDomain','observerSite','observerEvidence','poolLatencyMs','poolQualification','drMode','drSite','drDependencies','drAcceptance','recoveryObjectivesEvidence'])delete row.values[key];for(const row of old.design.availabilityMembers)delete row.values.site
  removeAvailabilityV17(old);const next=parseProject(JSON.stringify(old));expect(next.schemaVersion).toBe(32);expect(next.design.availabilityGroups[0].id).toBe(group.id);expect(next.design.availabilityGroups[0].values.defaultObserver).toBe('');expect(next.design.availabilityMembers[0].values.site).toBe('')
})
it('preserves site and observer references through sanitized sharing',()=>{
  const {p,group,site}=pool();group.values.observerDatabase=p.components[0].id;group.values.observerSite=site.id;group.values.observerEvidence='Private review';const shared=parseProject(serializeProject(sanitizeProject(p)));expect(JSON.stringify(shared)).not.toContain('Private review');expect(shared.design.availabilityGroups[0].values.observerDatabase).toBe(shared.components[0].id);expect(shared.design.availabilityMembers[0].values.site).toBe(shared.design.sites[0].id)
})
it('applies direct product prerequisites to selected roles rather than assuming every component is a management server',()=>{
  const p=newProject(),console=newComponent('vmm'),reporting=newComponent('scom');console.productDetails.role='console';reporting.productDetails.role='reporting';p.components.push(console,reporting);const required=managementFindings(p).filter(f=>f.code==='MANAGEMENT_DEPENDENCY');expect(required.some(f=>f.recordId===console.id)).toBe(false);expect(required.filter(f=>f.recordId===reporting.id)).toHaveLength(1);expect(required[0].message).toContain('warehouseDb')
})
