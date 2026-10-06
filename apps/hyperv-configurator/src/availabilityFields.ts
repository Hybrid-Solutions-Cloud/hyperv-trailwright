import type {Field} from './catalog'

const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const pool=(field:Field):Field=>({...field,when:{key:'strategy',values:['resourcepool']}})
export const availabilityFields:Field[]=[
  choice('siteScope','Service site scope',{single:'Single site',multiple:'Multiple sites / independently reviewed topology'}),
  {...text('serviceClusterIdentity','Application / database cluster identity'),when:{key:'strategy',values:['servicecluster','sqlfci','sqlag','filecluster']},hint:'Identify the service or database cluster. This is separate from its VM hosting cluster.'},
  pool(choice('poolWorkload','SCOM pool workload',{management:'Management-group workflows',network:'Network devices',unix:'UNIX / Linux',web:'Web URL monitoring',windows:'Windows agent reporting',other:'Other / qualification required'})),
  pool(choice('defaultObserver','SCOM database default observer',{enabled:'Explicitly enabled',disabled:'Explicitly disabled'})),
  pool(ref('observerDatabase','Default observer SQL service','$components')),
  pool(text('observerFailureDomain','Default observer correlated failure domain')),
  pool(ref('observerSite','Default observer site','sites')),
  pool(notes('observerEvidence','Default observer availability and dependency evidence')),
  pool(text('poolLatencyMs','Maximum inter-member latency (milliseconds)')),
  pool(notes('poolQualification','Pool membership, workload and certificate qualification')),
  choice('drMode','Site recovery strategy',{none:'No site recovery required',backup:'Backup and rebuild',warm:'Warm standby',replication:'Replicated recovery',external:'External recovery commitment'}),
  ref('drSite','Recovery target site','sites'),
  notes('drDependencies','Site recovery prerequisites and ordered activation'),
  notes('drAcceptance','Site failover, failback and restore acceptance'),
  notes('recoveryObjectivesEvidence','RTO / RPO requirements and evidence owner'),
]
export const availabilityMemberFields:Field[]=[ref('site','Member site','sites')]
