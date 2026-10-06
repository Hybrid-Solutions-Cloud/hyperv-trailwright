import type {Field,Collection} from './catalog'
import type {Answers} from './catalog'
import type {Project} from './project'
import {decisionHiddenFields} from './componentDecisions'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const sql=(field:Field):Field=>({...field,when:{key:'strategy',values:['sqlag','sqlfci']}})
const ag=(field:Field):Field=>({...field,when:{key:'strategy',values:['sqlag']}})
const library=(field:Field):Field=>({...field,when:{key:'product',values:['library']}})
export const availabilityDetailFields:Field[]=[
  ag(choice('sqlAgKind','SQL availability group kind',{basic:'Basic AG (Standard)',full:'Full AG (Enterprise)',other:'Other / separate qualification'})),
  sql(choice('sqlClusterType','SQL clustering platform',{wsfc:'Windows Server Failover Cluster',external:'External cluster manager',none:'No cluster manager / read scale'})),
  sql(text('sqlListenerPort','SQL listener / instance TCP port')),
  sql(text('sqlListenerAddresses','SQL listener addresses / subnet contract')),
  ag(choice('sqlSeeding','SQL database initialization',{automatic:'Automatic seeding',manual:'Backup / restore and join'})),
  sql(notes('sqlEndpointSecurity','SQL endpoint, SPN, authentication and encryption contract')),
  sql(notes('sqlStorageEvidence','SQL shared-storage / replica-storage ownership and readiness')),
  sql(notes('sqlFailoverAcceptance','SQL synchronization, failover, reconnect and restore acceptance')),
  sql(notes('sqlDatabaseEvidence','SQL database assignment and consuming-product support review')),
  library(choice('libraryRole','VMM library server role',{general:'General-use clustered file server',standalone:'Standalone library server',sofs:'Scale-out file server role (review conflict)',external:'External library service'})),
  library(text('libraryShare','VMM library share UNC path')),
  library(ref('libraryVmm','Consuming VMM service','$components')),
  library(notes('libraryAccess','Library share, NTFS and VMM registration permissions')),
  library(notes('libraryRecovery','Library content backup, copy/replication and recovery acceptance')),
  library(notes('libraryStorage','Library backing storage / SOFS share contract')),
]
export const availabilityPlacementFields:Field[]=[
  choice('placementBasis','Placement assessment basis',{current:'Current observed placement',desired:'Desired placement'}),
  choice('placementMode','Physical placement mode',{pinned:'Pinned VM / server placement',dynamic:'Dynamic placement with enforced separation',provider:'Provider-managed placement contract',physical:'Dedicated physical server'}),
  ref('physicalHost','Underlying physical host design record','hosts'),
  text('nativeHostId','Underlying physical host immutable identity'),text('hostScope','Physical host provider / inventory scope'),
  text('placementObservedAt','Placement observation time (UTC)'),notes('placementEvidence','Current placement or desired mapping evidence'),
  notes('placementPolicy','Enforced separation policy identity and applicability'),notes('admissionEvidence','Provider admission, failover capacity and restart evidence'),
  choice('sqlCommit','SQL replica commit mode',{sync:'Synchronous commit',async:'Asynchronous commit',configuration:'Configuration only'}),
  choice('sqlFailover','SQL replica failover mode',{automatic:'Automatic',manual:'Manual'}),
  choice('sqlSecondaryRead','SQL secondary read access',{none:'Disabled',read:'Enabled / read intent'}),
  choice('sqlSecondaryBackup','SQL secondary backup use',{none:'Disabled',enabled:'Requested'}),
]
export const availabilityDatabasesCollection:Collection={key:'availabilityDatabases',title:'Availability database assignments',singular:'database assignment',section:'hosting',description:'Bind one named database to its SQL availability group or instance and consuming service. Database records do not add another SQL server or licensing quantity.',fields:[
  {...text('name','Database name'),required:true},text('owner','Database owner'),{...ref('group','Database availability group / instance','availabilityGroups'),required:true},
  ref('consumer','Consuming management component','$components'),choice('purpose','Database purpose',{vmm:'VMM database',operational:'SCOM operational',warehouse:'SCOM data warehouse',acs:'SCOM ACS',reporting:'SSRS databases',other:'Other database'}),
  notes('supportEvidence','Database support, storage and recovery mapping evidence'),
]}
/** Fields for one record after project-level component decisions hide the questions that no longer apply. */
export function recordFields(project:Project,collection:Collection,values:Answers):Field[]{
  const hidden=decisionHiddenFields(project,collection.key),fields=baseRecordFields(project,collection,values)
  return hidden.size?fields.filter(f=>!hidden.has(f.key)):fields
}
function baseRecordFields(project:Project,collection:Collection,values:Answers):Field[]{
  if(collection.key==='profiles'&&values.method==='vmm'&&values.profileState==='existing'){
    const readback=['virtualHardDiskId','joinMode','profileDomain','profileDomainOu','domainJoinRunAsId','computerAccessRunAsId','networkAdapterProfileIds','networkAdapterReview','partitionStyle','diskConfiguration','diskConfigurationEvidence','vmPaths','driverSelection','driverArtifact','driverMatchingTags','answerFileId','answerFileSha256','timeZoneId']
    return collection.fields.map(f=>readback.includes(f.key)?{...f,when:undefined,required:false,hint:'Record the existing physical profile readback; this does not request profile creation.'}:f)
  }
  if(collection.key==='availabilityMembers'&&project.design.availabilityGroups.find(g=>g.id===values.group)?.values.strategy!=='sqlag')return collection.fields.filter(f=>!f.key.startsWith('sql'))
  return collection.fields
}
