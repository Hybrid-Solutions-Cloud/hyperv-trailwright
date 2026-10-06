import type {Project} from './project'
import type {Finding} from './validation'
import {validTime} from './discoveryContract'
import {releaseLabel} from './supportCatalog'

const norm=(value:unknown)=>String(value||'').trim().toLowerCase()
export const SQL_HA_SOURCES=[
  'https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2022?view=sql-server-ver17',
  'https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-2025?view=sql-server-ver17',
  'https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/basic-availability-groups-always-on-availability-groups?view=sql-server-ver17',
  'https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/availability-modes-always-on-availability-groups?view=sql-server-ver17',
]
/** Merge declared correlated domains when precise physical-host mappings reveal another shared failure. */
export function placementDomains(project:Project,groupId:string){
  const parent=new Map<string,string>(),componentKeys=new Map<string,string>(),labels=new Map<string,string>(),hostOwners=new Map<string,string[]>()
  const root=(key:string):string=>{if(!parent.has(key))parent.set(key,key);let node=key;while(parent.get(node)!==node)node=parent.get(node)!;return node}
  const join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x<y?y:x,x<y?x:y)}
  const rows=project.design.availabilityMembers.filter(m=>m.values.group===groupId)
  for(const row of rows){
    const c=project.components.find(c=>c.id===row.values.component);if(!c)continue
    const key='component:'+c.id,label=norm(c.failureDomain);root(key);componentKeys.set(c.id,key)
    if(label){join(key,'domain:'+label);labels.set(label,'domain:'+label)}
    if(['pinned','physical'].includes(String(row.values.placementMode))){
      const keys:string[]=[]
      if(row.values.physicalHost&&project.design.hosts.some(h=>h.id===row.values.physicalHost))keys.push('design-host:'+String(row.values.physicalHost))
      if(row.values.nativeHostId&&row.values.hostScope)keys.push('native-host:'+norm(row.values.hostScope)+':'+norm(row.values.nativeHostId))
      for(const host of keys){join(key,host);const owners=hostOwners.get(host)||[];if(!owners.includes(c.id))owners.push(c.id);hostOwners.set(host,owners)}
    }
  }
  return {domains:new Map([...componentKeys].map(([id,key])=>[id,root(key)])),labels:new Map([...labels].map(([label,key])=>[label,root(key)])),sharedHosts:[...hostOwners].filter(([,ids])=>ids.length>1).map(([identity,componentIds])=>({identity,componentIds}))}
}

export function availabilityDetails(project:Project,groupId:string){
  const group=project.design.availabilityGroups.find(g=>g.id===groupId)!,v=group.values,name=String(v.name||'Availability group'),findings:Finding[]=[]
  const add=(code:string,message:string,key:string,recordId=groupId,severity:Finding['severity']='error',section='hosting')=>findings.push({code,message:name+': '+message,fieldKey:key,recordId,severity,section})
  const rows=project.design.availabilityMembers.filter(m=>m.values.group===groupId),members=rows.map(row=>({row,c:project.components.find(c=>c.id===row.values.component)})).filter(r=>!!r.c)
  const workers=members.filter(r=>r.row.values.role!=='observer')
  const placement=placementDomains(project,groupId)
  if(v.strategy!=='external')for(const {row,c:member}of members){
    const c=member!,m=row.values
    const required=(keys:string[])=>{for(const key of keys)if(!m[key])add('HA_PLACEMENT_INPUT','Complete the placement basis, identity and assurance contract.',key,row.id,'warning')}
    required(['placementBasis','placementMode','placementEvidence'])
    if(m.placementBasis==='current'){
      required(['placementObservedAt'])
      if(m.placementObservedAt&&(!validTime(m.placementObservedAt)||Date.parse(String(m.placementObservedAt))>Date.now()))add('HA_PLACEMENT_TIME','Use a valid, non-future UTC placement observation.','placementObservedAt',row.id)
    }
    if(m.placementBasis==='desired'&&c.lifecycle==='preserve')add('HA_PRESERVED_PLACEMENT','A preserved component needs current placement; changing its placement requires explicit configuration scope.','placementBasis',row.id)
    if(['pinned','physical'].includes(String(m.placementMode))&&!m.physicalHost&&!(m.nativeHostId&&m.hostScope))add('HA_PHYSICAL_IDENTITY','Link a design host or supply the native host identity and provider scope.','nativeHostId',row.id)
    if(c.hosting==='physical'&&m.placementMode&&m.placementMode!=='physical')add('HA_PHYSICAL_MODE','This component is a physical server; its placement mode must reflect that.','placementMode',row.id)
    if(c.hosting!=='physical'&&m.placementMode==='physical')add('HA_PHYSICAL_MODE','Use a VM or provider placement mode for this component.','placementMode',row.id)
    if(['dynamic','provider'].includes(String(m.placementMode))){required(['placementPolicy','admissionEvidence']);if(m.physicalHost||m.nativeHostId)add('HA_DYNAMIC_HOST_RETAINED','Fixed host identities are retained but not used for dynamic/provider placement arithmetic.','placementMode',row.id,'warning')}
    if(v.strategy==='providerrestart')required(['placementPolicy','admissionEvidence'])
    if(m.physicalHost){const host=project.design.hosts.find(h=>h.id===m.physicalHost),cluster=project.design.clusters.find(g=>g.id===host?.values.cluster);if(cluster?.values.site&&m.site&&cluster.values.site!==m.site)add('HA_HOST_SITE','The underlying host cluster site conflicts with the member site.','physicalHost',row.id)}
  }
  for(const shared of placement.sharedHosts)if(new Set(shared.componentIds.map(id=>norm(project.components.find(c=>c.id===id)?.failureDomain))).size>1)add('HA_SHARED_PHYSICAL_HOST','Members on the same physical host declare different failure domains. Their losses are correlated in capacity calculations.','antiAffinity')
  const databases=(project.design.availabilityDatabases||[]).filter(d=>d.values.group===groupId)
  let sql:{status:'not-applicable'|'review'|'conflict';databaseCount:number;replicaCount:number;automaticCandidates:number;runtimeSynchronized:false}={status:'not-applicable',databaseCount:databases.length,replicaCount:workers.length,automaticCandidates:0,runtimeSynchronized:false}
  if(['sqlag','sqlfci'].includes(String(v.strategy))){
    const sqlStart=findings.length
    for(const key of ['sqlClusterType','sqlListenerPort','sqlListenerAddresses','sqlEndpointSecurity','sqlStorageEvidence','sqlFailoverAcceptance','sqlDatabaseEvidence'])if(!v[key])add('SQL_HA_INPUT','Complete the SQL topology, listener, storage and acceptance contract.',key)
    if(v.sqlListenerPort&&(!/^\d+$/.test(String(v.sqlListenerPort))||Number(v.sqlListenerPort)<1||Number(v.sqlListenerPort)>65535))add('SQL_HA_PORT','The SQL listener port must be an integer from 1 to 65535.','sqlListenerPort')
    if(v.sqlClusterType&&v.sqlClusterType!=='wsfc')add('SQL_HA_PLATFORM','This management-product HA baseline uses Windows SQL on WSFC; qualify other platforms separately.','sqlClusterType',groupId,'warning')
    if(!databases.length)add('SQL_HA_DATABASES','Assign the exact protected databases and consuming services.','sqlDatabaseEvidence')
    const dbNames=new Set<string>()
    for(const db of databases){
      const key=norm(db.values.name);if(dbNames.has(key))add('SQL_HA_DATABASE_DUPLICATE','A database name is assigned twice within this SQL group.','name',db.id);dbNames.add(key)
      if(!key||!db.values.purpose)add('SQL_DATABASE_INPUT','Record a database name and its purpose.','name',db.id)
      if(db.values.purpose&&db.values.purpose!=='other'&&!db.values.consumer)add('SQL_DATABASE_INPUT','Link the consuming management component.','consumer',db.id)
      if(!db.values.owner||!db.values.supportEvidence)add('SQL_DATABASE_REVIEW','Record the database owner and product/storage/recovery review.','supportEvidence',db.id,'warning')
      const consumer=project.components.find(c=>c.id===db.values.consumer)
      if(db.values.purpose==='vmm'&&consumer&&consumer.product!=='vmm')add('SQL_DATABASE_CONSUMER','The VMM database must link a VMM component.','consumer',db.id)
      if(['operational','warehouse','acs','reporting'].includes(String(db.values.purpose))&&consumer&&consumer.product!=='scom')add('SQL_DATABASE_CONSUMER','This SCOM database assignment must link a SCOM component.','consumer',db.id)
      if(db.values.purpose==='reporting'&&v.strategy==='sqlag')add('SCOM_REPORTING_AG_REVIEW','Qualify SSRS catalog and temporary database availability separately from the SCOM operational/warehouse AG.','purpose',db.id,'warning')
      if(consumer?.product==='scom'&&workers.some(r=>r.c!.productDetails.engineHost!=='windows'))add('SCOM_SQL_ENGINE','The reviewed SCOM database contract requires SQL Server on Windows; arbitrary external SQL/PaaS is not interchangeable.','sqlDatabaseEvidence')
    }
    const versions=new Set<string>(),editions=new Set<string>();let limitsKnown=workers.length>0
    for(const {c:component}of workers){const c=component!;if(c.product!=='sql')continue
      const release=['2022','2025'].find(release=>releaseLabel(c.version,release));if(!release){add('SQL_HA_VERSION','Obtain a feature review for this SQL release; current limits cover Windows SQL 2022 and 2025.','version',c.id,'warning','management');limitsKnown=false}else versions.add(release)
      editions.add(String(c.productDetails.edition));if(!['standard','enterprise'].includes(String(c.productDetails.edition))){add('SQL_HA_EDITION','Select a precise Standard/Enterprise feature baseline or independently qualify this edition.','edition',c.id,'warning','products');limitsKnown=false}
      if(c.productDetails.engineHost!=='windows'){add('SQL_HA_ENGINE','Qualify the exact engine platform before applying the Windows SQL feature limits.','engineHost',c.id,'warning','products');limitsKnown=false}
    }
    if(versions.size>1||editions.size>1)add('SQL_HA_MEMBER_BASELINE','Members use different SQL releases or editions; qualify an explicit transition topology before handoff.','sqlDatabaseEvidence')
    const edition=editions.size===1?[...editions][0]:''
    limitsKnown=limitsKnown&&versions.size===1&&editions.size===1&&workers.every(r=>r.c!.product==='sql')
    if(limitsKnown&&v.strategy==='sqlfci'&&((edition==='standard'&&workers.length>2)||(edition==='enterprise'&&workers.length>16)))add('SQL_FCI_NODE_LIMIT','The reviewed FCI node limit is two for Standard or sixteen for Enterprise.','strategy')
    if(v.strategy==='sqlag'){
      for(const key of ['sqlAgKind','sqlSeeding'])if(!v[key])add('SQL_AG_INPUT','Select AG kind and database initialization. ',key)
      if(v.sqlAgKind==='basic'){
        if(limitsKnown&&edition!=='standard')add('SQL_BASIC_EDITION','Basic AGs require Standard edition servers.','sqlAgKind')
        if(limitsKnown&&(workers.length!==2||dbNames.size!==1))add('SQL_BASIC_LIMIT','A Windows basic AG requires two replicas and one database. Separate basic groups may share a SQL instance.','sqlAgKind')
      }
      if(limitsKnown&&v.sqlAgKind==='full'&&edition==='standard')add('SQL_FULL_EDITION','Full availability groups require the reviewed Enterprise feature baseline.','sqlAgKind')
      if(limitsKnown&&v.sqlAgKind==='full'&&workers.length>9)add('SQL_AG_REPLICA_LIMIT','The reviewed full AG baseline allows one primary and up to eight secondary replicas.','sqlAgKind')
      if(v.sqlAgKind==='other')add('SQL_AG_TOPOLOGY_REVIEW','Qualify the exact AG topology independently of this baseline.','sqlDatabaseEvidence',groupId,'warning')
      for(const {row}of workers){const m=row.values
        for(const key of ['sqlCommit','sqlFailover','sqlSecondaryRead','sqlSecondaryBackup'])if(!m[key])add('SQL_REPLICA_INPUT','Complete each replica commit, failover and secondary-use decision.',key,row.id)
        if(m.sqlFailover==='automatic'&&m.sqlCommit!=='sync')add('SQL_AUTOMATIC_COMMIT','Automatic failover requires synchronous-commit candidates. Runtime synchronization and WSFC quorum are still required.','sqlFailover',row.id)
        if(m.sqlCommit==='configuration'&&v.sqlClusterType==='wsfc')add('SQL_CONFIGURATION_REPLICA','Configuration-only replicas are outside this Windows WSFC baseline.','sqlCommit',row.id)
        if(v.sqlAgKind==='basic'&&(m.sqlSecondaryRead==='read'||m.sqlSecondaryBackup==='enabled'))add('SQL_BASIC_SECONDARY','Basic AG secondary replicas cannot serve reads or backups.','sqlSecondaryRead',row.id)
      }
      const automatic=workers.filter(r=>r.row.values.sqlFailover==='automatic'&&r.row.values.sqlCommit==='sync').length
      if(automatic===1)add('SQL_AUTOMATIC_PAIR','Automatic failover needs at least two configured synchronous automatic candidates.','sqlFailoverAcceptance')
      if(workers.filter(r=>r.row.values.sqlCommit==='sync').length>5)add('SQL_SYNCHRONOUS_LIMIT_REVIEW','Review the exact release limit for this number of synchronous replicas before handoff.','sqlDatabaseEvidence',groupId,'warning')
      sql.automaticCandidates=automatic
    }
    sql={...sql,status:findings.slice(sqlStart).some(f=>f.severity==='error')?'conflict':'review',databaseCount:dbNames.size}
  }else if(databases.length)add('SQL_DATABASE_GROUP','Database assignments require a SQL AG or FCI strategy.','strategy')
  if(v.product==='library'){
    for(const key of ['libraryRole','libraryShare','libraryVmm','libraryAccess','libraryRecovery','libraryStorage'])if(!v[key])add('LIBRARY_HA_INPUT','Complete the library role, share, consuming service and recovery contract.',key,groupId,'warning')
    if(v.libraryShare&&!/^\\\\[^\\\s]+\\[^\\\s]+(?:\\.*)?$/.test(String(v.libraryShare)))add('LIBRARY_UNC','Use an explicit UNC server/share path for the library.','libraryShare')
    if(v.strategy==='filecluster'&&v.libraryRole!=='general')add('LIBRARY_CLUSTER_ROLE','The reviewed HA library server uses the general-use file-server role. A backing SOFS share is a separate storage contract.','libraryRole')
    if(v.libraryRole==='sofs')add('LIBRARY_SOFS_ROLE','SOFS cannot itself be the VMM library-server role; record a separate library server and backing-share contract.','libraryRole')
    const vmm=project.components.find(c=>c.id===v.libraryVmm)
    if(vmm&&(vmm.product!=='vmm'||vmm.productDetails.role!=='service'))add('LIBRARY_VMM_ROLE','Link the consuming VMM management service.','libraryVmm')
    if(v.strategy==='filecluster'&&!v.serviceClusterIdentity)add('LIBRARY_CLUSTER_ID','Record the library file-server cluster identity.','serviceClusterIdentity')
    for(const other of project.design.availabilityGroups.filter(g=>g.values.strategy==='servicecluster'))if(norm(v.serviceClusterIdentity)&&norm(v.serviceClusterIdentity)===norm(other.values.serviceClusterIdentity))add('LIBRARY_VMM_CLUSTER','The library HA role must not share the VMM service cluster.','serviceClusterIdentity')
  }
  return {placement:{sharedHosts:placement.sharedHosts,memberCount:members.length,inputs:rows.map(r=>({memberId:r.id,componentId:r.values.component,values:{...r.values}}))},sql,databases,findings,sources:sql.status!=='not-applicable'?SQL_HA_SOURCES:v.product==='library'?['https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025','https://learn.microsoft.com/en-us/system-center/vmm/ha-library?view=sc-vmm-2025']:[]}
}
