import {it,expect} from 'vitest'
import {newProject,newComponent,parseProject,serializeProject,type Project} from './project'
import {collections,newRecord,type Answers} from './catalog'
import {availabilityDetails,placementDomains} from './availabilityDetails'
import {availabilityPlan} from './availabilityPlan'
import {managementFindings} from './managementValidation'
import {removeAvailabilityV17} from './testing/legacyAvailabilityDetails'
import {sanitizeProject} from './sanitize'
import {environmentFiles,topology} from './exports'
import {recordFields} from './availabilityDetailFields'
const add=(p:Project,key:string,values:Answers)=>{const row=newRecord(collections.find(c=>c.key===key)!);Object.assign(row.values,values);p.design[key].push(row);return row}
function sqlFixture(count=2){
  const p=newProject(),group=add(p,'availabilityGroups',{name:'Database HA',product:'sql',strategy:'sqlag',sqlAgKind:'basic',sqlClusterType:'wsfc',sqlListenerPort:'1433',sqlListenerAddresses:'10.20.0.10/24',sqlSeeding:'manual',sqlEndpointSecurity:'TLS / SPN / runtime identity contract',sqlStorageEvidence:'Separate replica storage',sqlFailoverAcceptance:'Confirm synchronized databases, WSFC quorum and failover',sqlDatabaseEvidence:'Database owner support review',minimumActive:1,failureDomainsLost:1})
  for(let i=0;i<count;i++){const c=newComponent('sql');c.version='2022';c.name='SQL '+i;c.failureDomain='Rack '+i;Object.assign(c.productDetails,{edition:'standard',engineHost:'windows',topology:'ag'});p.components.push(c);add(p,'availabilityMembers',{group:group.id,component:c.id,role:i?'replica':'active',placementBasis:'desired',placementMode:'pinned',nativeHostId:'host-'+i,hostScope:'Example fabric',placementEvidence:'Reviewed planned placement',sqlCommit:'sync',sqlFailover:'automatic',sqlSecondaryRead:'none',sqlSecondaryBackup:'none'})}
  const database=add(p,'availabilityDatabases',{name:'ExampleDatabase',owner:'DBA',group:group.id,purpose:'other',supportEvidence:'Reviewed database mapping'})
  return {p,group,database}
}
const codes=(p:Project,id:string)=>availabilityDetails(p,id).findings.map(f=>f.code)
it('correlates distinct declared domains on the same exact physical host',()=>{
  const {p,group}=sqlFixture();p.design.availabilityMembers[1].values.nativeHostId='HOST-0';const domains=placementDomains(p,group.id);expect(domains.domains.get(p.components[0].id)).toBe(domains.domains.get(p.components[1].id));expect(codes(p,group.id)).toContain('HA_SHARED_PHYSICAL_HOST');expect(managementFindings(p).map(f=>f.code)).toContain('HA_FAILURE_CAPACITY')
})
it('keeps provider-managed placement under evidence review without fabricating a physical host',()=>{
  const {p,group}=sqlFixture();for(const row of p.design.availabilityMembers){row.values.placementMode='provider';row.values.nativeHostId='retained-host'}expect(placementDomains(p,group.id).sharedHosts).toEqual([]);expect(codes(p,group.id)).toContain('HA_PLACEMENT_INPUT');expect(codes(p,group.id)).toContain('HA_DYNAMIC_HOST_RETAINED')
})
it('checks placement timestamps, preserved intent and host/site references',()=>{
  const {p,group}=sqlFixture();p.components[0].lifecycle='preserve';expect(codes(p,group.id)).toContain('HA_PRESERVED_PLACEMENT');const row=p.design.availabilityMembers[0];row.values.placementBasis='current';row.values.placementObservedAt='2026-02-30T12:00:00Z';expect(codes(p,group.id)).toContain('HA_PLACEMENT_TIME');const cluster=add(p,'clusters',{site:'different-site'}),host=add(p,'hosts',{cluster:cluster.id});row.values.physicalHost=host.id;row.values.site='member-site';expect(codes(p,group.id)).toContain('HA_HOST_SITE')
})
it('accepts a declared two-replica one-database basic design without claiming synchronized runtime',()=>{
  const {p,group}=sqlFixture(),plan=availabilityDetails(p,group.id);expect(plan.findings).toEqual([]);expect(plan.sql).toMatchObject({status:'review',databaseCount:1,replicaCount:2,automaticCandidates:2,runtimeSynchronized:false})
})
it('rejects basic AG database, replica and secondary feature excesses',()=>{
  const {p,group}=sqlFixture(3);add(p,'availabilityDatabases',{group:group.id,name:'SecondDb',purpose:'other'});p.design.availabilityMembers[0].values.sqlSecondaryRead='read';const found=codes(p,group.id);expect(found).toContain('SQL_BASIC_LIMIT');expect(found).toContain('SQL_BASIC_SECONDARY')
})
it('allows separate basic groups to reuse a SQL instance while keeping database names unique within each group',()=>{
  const {p,group,database}=sqlFixture(),second=add(p,'availabilityGroups',{...group.values,name:'Second basic AG'});for(const member of [...p.design.availabilityMembers])add(p,'availabilityMembers',{...member.values,group:second.id});add(p,'availabilityDatabases',{...database.values,group:second.id});expect(codes(p,second.id)).not.toContain('SQL_BASIC_LIMIT');expect(codes(p,second.id)).not.toContain('SQL_HA_DATABASE_DUPLICATE');add(p,'availabilityDatabases',{...database.values,name:'EXAMPLEDATABASE'});expect(codes(p,group.id)).toContain('SQL_HA_DATABASE_DUPLICATE')
})
it('applies dated Standard FCI and Enterprise AG limits only to known platforms/releases',()=>{
  const {p,group}=sqlFixture(3);group.values.strategy='sqlfci';expect(codes(p,group.id)).toContain('SQL_FCI_NODE_LIMIT');p.components[0].version='Future release';expect(codes(p,group.id)).toContain('SQL_HA_VERSION');expect(codes(p,group.id)).not.toContain('SQL_FCI_NODE_LIMIT');const enterprise=sqlFixture(10);enterprise.group.values.sqlAgKind='full';for(const c of enterprise.p.components)c.productDetails.edition='enterprise';expect(codes(enterprise.p,enterprise.group.id)).toContain('SQL_AG_REPLICA_LIMIT')
})
it('checks automatic failover pairs and basic/full edition boundaries',()=>{
  const {p,group}=sqlFixture();p.design.availabilityMembers[1].values.sqlCommit='async';expect(codes(p,group.id)).toContain('SQL_AUTOMATIC_COMMIT');expect(codes(p,group.id)).toContain('SQL_AUTOMATIC_PAIR');group.values.sqlAgKind='full';expect(codes(p,group.id)).toContain('SQL_FULL_EDITION');group.values.sqlAgKind='basic';for(const c of p.components)c.productDetails.edition='enterprise';expect(codes(p,group.id)).toContain('SQL_BASIC_EDITION')
})
it('validates database consumers, port ranges and SCOM engine boundaries',()=>{
  const {p,group,database}=sqlFixture(),consumer=newComponent('scom');p.components.push(consumer);database.values.consumer=consumer.id;database.values.purpose='operational';p.components[0].productDetails.engineHost='external';group.values.sqlListenerPort='70000';expect(codes(p,group.id)).toContain('SCOM_SQL_ENGINE');expect(codes(p,group.id)).toContain('SQL_HA_PORT');database.values.purpose='vmm';expect(codes(p,group.id)).toContain('SQL_DATABASE_CONSUMER')
})
it('separates the HA library role from SOFS backing storage and from the VMM service cluster',()=>{
  const p=newProject(),vmm=newComponent('vmm'),library=newComponent('library');vmm.productDetails.role='service';vmm.applicationHa='Service HA';p.components.push(vmm,library);const service=add(p,'availabilityGroups',{product:'vmm',strategy:'servicecluster',serviceClusterIdentity:'ServiceCluster'}),group=add(p,'availabilityGroups',{product:'library',strategy:'filecluster',serviceClusterIdentity:'SERVICECLUSTER',libraryRole:'sofs',libraryShare:'not-UNC',libraryVmm:vmm.id});add(p,'availabilityMembers',{group:service.id,component:vmm.id});add(p,'availabilityMembers',{group:group.id,component:library.id});add(p,'dependencies',{dependent:vmm.id,prerequisite:library.id,kind:'library',phase:'bootstrap'});for(const code of ['LIBRARY_SOFS_ROLE','LIBRARY_CLUSTER_ROLE','LIBRARY_UNC','LIBRARY_VMM_CLUSTER'])expect(codes(p,group.id)).toContain(code);expect(managementFindings(p).map(f=>f.code)).not.toContain('HA_LIBRARY_DEPENDENCY');group.values.strategy='providerrestart';expect(managementFindings(p).map(f=>f.code)).toContain('HA_LIBRARY_DEPENDENCY')
})
it('migrates actual schema 16 without inventing placement, SQL assignments or library HA',()=>{
  const {p}=sqlFixture(),old:any=JSON.parse(serializeProject(p));old.schemaVersion=16;expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 16');removeAvailabilityV17(old);const next=parseProject(JSON.stringify(old));expect(next.schemaVersion).toBe(32);expect(next.design.availabilityDatabases).toEqual([]);expect(next.design.availabilityGroups[0].values.sqlAgKind).toBe('');expect(next.design.availabilityMembers[0].values.placementMode).toBe('')
})
it('accepts a separate general-use library cluster with a separately described backing SOFS share',()=>{
  const p=newProject(),vmm=newComponent('vmm');vmm.productDetails.role='service';p.components.push(vmm);const group=add(p,'availabilityGroups',{product:'library',strategy:'filecluster',serviceClusterIdentity:'LibraryCluster',libraryRole:'general',libraryShare:'\\\\library.example.test\\images',libraryVmm:vmm.id,libraryAccess:'Share/NTFS and registration owner review',libraryRecovery:'Independent content backup and tested restore',libraryStorage:'Separate backing SOFS share; library-server role remains general-use'});expect(availabilityDetails(p,group.id).findings).toEqual([])
})
it('retains sanitized database/group links and exports exact contracts with database topology',()=>{
  const {p,group,database}=sqlFixture();database.values.consumer=p.components[0].id;const shared=parseProject(serializeProject(sanitizeProject(p)));expect(shared.design.availabilityDatabases[0].values.group).toBe(shared.design.availabilityGroups[0].id);expect(shared.design.availabilityDatabases[0].values.consumer).toBe(shared.components[0].id);const files=environmentFiles(p),plan=JSON.parse(files['plans/availability-assessment.json']);expect(plan.groups[0].details.databases[0].id).toBe(database.id);expect(topology(p).drawio).toContain(database.id);expect(files['environment/availability.yml']).toContain('availabilityDatabases');const collection=collections.find(c=>c.key==='availabilityMembers')!;expect(recordFields(p,collection,p.design.availabilityMembers[0].values).some(f=>f.key==='sqlCommit')).toBe(true);group.values.strategy='resourcepool';expect(recordFields(p,collection,p.design.availabilityMembers[0].values).some(f=>f.key==='sqlCommit')).toBe(false)
})
it('uses physical-host correlation in SCOM voting as well as generic service survival',()=>{
  const {p,group}=sqlFixture(3);Object.assign(group.values,{product:'scom',strategy:'resourcepool',defaultObserver:'disabled'});for(const c of p.components){c.product='scom';c.version='2025';c.productDetails=newComponent('scom').productDetails;Object.assign(c.productDetails,{role:'management',managementGroup:'Example'})}for(const row of p.design.availabilityMembers)row.values.role='active';p.design.availabilityMembers[1].values.nativeHostId='host-0';expect(availabilityPlan(p).groups[0].voting).toMatchObject({status:'insufficient',totalVotes:3,worstRemainingVotes:1})
})
