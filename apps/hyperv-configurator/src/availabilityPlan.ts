import type {Project,Component} from './project'
import type {Finding} from './validation'
import {releaseLabel} from './supportCatalog'
import {availabilityDetails,placementDomains} from './availabilityDetails'

export const AVAILABILITY_SOURCES={
  vmm:'https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025',
  scom:'https://learn.microsoft.com/en-us/system-center/scom/plan-resource-pool-design?view=sc-om-2025',
  observers:'https://learn.microsoft.com/en-us/powershell/module/operationsmanager/new-scomresourcepool?view=systemcenter-ps-2025',
}
const norm=(value:unknown)=>String(value||'').trim().toLowerCase()
/** Role-specific design analysis. Votes model declared correlated failures, not live quorum or support certification. */
export function availabilityPlan(project:Project){
  const components=new Map(project.components.map(c=>[c.id,c]))
  const groups=project.design.availabilityGroups.map(group=>{
    const v=group.values,name=String(v.name||'Availability group'),findings:Finding[]=[]
    const details=availabilityDetails(project,group.id),placement=placementDomains(project,group.id)
    findings.push(...details.findings)
    const add=(code:string,message:string,fieldKey:string,severity:Finding['severity']='error',recordId=group.id,section='hosting')=>findings.push({code,message:name+': '+message,fieldKey,severity,recordId,section})
    const links=project.design.availabilityMembers.filter(m=>m.values.group===group.id)
    const resolved=links.map(link=>({link,component:components.get(String(link.values.component))})).filter((row):row is {link:typeof links[number];component:Component}=>!!row.component)
    const workers=resolved.filter(r=>r.link.values.role!=='observer'),observers=resolved.filter(r=>r.link.values.role==='observer')
    const membershipIds=resolved.map(r=>r.component.id),unique=new Set(membershipIds).size===membershipIds.length
    const localStrategy=!['external','providerrestart'].includes(String(v.strategy))
    if(localStrategy){
      if(!v.siteScope)add('HA_SITE_SCOPE','Choose the service site scope; provider placement does not establish site resilience.','siteScope')
      for(const {link} of resolved)if(!link.values.site)add('HA_MEMBER_SITE','Assign each member and observer a site.','site','error',link.id)
      const sites=new Set(resolved.map(r=>String(r.link.values.site)).filter(Boolean))
      if(v.siteScope==='single'&&sites.size>1)add('HA_SITE_CONFLICT','Single-site scope conflicts with member sites.','siteScope')
      if(v.strategy==='servicecluster'&&(v.siteScope==='multiple'||sites.size>1))add('VMM_STRETCHED_SERVICE','The reviewed VMM service-cluster baseline excludes stretched management-service clusters.','siteScope')
      if(v.strategy==='resourcepool'&&(v.siteScope==='multiple'||sites.size>1))add('SCOM_POOL_SITES','The reviewed resource-pool design keeps its voting members in one datacenter. Model site recovery separately.','siteScope')
    }
    if(!v.drMode)add('HA_DR_DECISION','Record a separate site recovery decision.','drMode','warning')
    if(!v.recoveryObjectivesEvidence)add('HA_RECOVERY_OBJECTIVES','Record the RTO/RPO requirements and their evidence owner; zero is not proof of an agreed objective.','recoveryObjectivesEvidence','warning')
    if(v.drMode&&v.drMode!=='none')for(const key of ['drSite','drDependencies','drAcceptance'])if(!v[key])add('HA_DR_INPUT','Complete the recovery site, prerequisites and acceptance contract.',key)
    if(v.drSite&&resolved.some(r=>r.link.values.site===v.drSite))add('HA_DR_SHARED_SITE','The recovery site also hosts a member; explain the failure scope and surviving dependencies.','drDependencies','warning')
    if(observers.length&&v.strategy!=='resourcepool')add('HA_OBSERVER_STRATEGY','Observer-only members belong to SCOM resource pools, not this availability strategy.','strategy')
    if(['servicecluster','sqlfci','sqlag'].includes(String(v.strategy))&&!v.serviceClusterIdentity)add('HA_SERVICE_CLUSTER_ID','Record the application/database cluster identity separately from VM hosting.','serviceClusterIdentity')
    if(v.strategy==='servicecluster'){
      for(const {component:c} of workers){
        if(c.product!=='vmm'||c.productDetails.role!=='service')add('VMM_HA_ROLE','Only VMM management-service roles can be service-cluster members.','role','error',c.id,'products')
        if(c.product==='vmm'&&c.productDetails.serviceTopology!=='clustered')add('VMM_HA_SERVICE_TOPOLOGY','The VMM member must select clustered service topology.','serviceTopology','error',c.id,'products')
      }
      if(workers.length>16)add('VMM_HA_NODE_LIMIT','The reviewed VMM service cluster supports at most sixteen nodes.','strategy')
      for(const other of project.design.availabilityGroups.filter(g=>g.id!==group.id&&['sqlfci','sqlag'].includes(String(g.values.strategy))))if(norm(v.serviceClusterIdentity)&&norm(v.serviceClusterIdentity)===norm(other.values.serviceClusterIdentity))add('VMM_HA_DATABASE_CLUSTER','VMM and its SQL service must not share the same application cluster identity.','serviceClusterIdentity')
    }
    if(v.product==='wac'&&localStrategy&&new Set(workers.map(r=>r.component.productDetails.mode)).size>1)add('WAC_HA_MODES','Different WAC modes do not form an application HA pair.','strategy')
    if(workers.some(r=>r.component.product==='ome')&&localStrategy)add('OME_APPLICATION_HA_REVIEW','OME appliance backup/rebuild and provider restart require their own review; component duplication does not establish appliance application HA.','strategy','warning')
    let voting:{status:'not-applicable'|'unknown'|'insufficient'|'consistent';totalVotes:number|null;requiredVotes:number|null;worstRemainingVotes:number|null;worstRemainingWorkers:number|null;assumptions:string[]}={status:'not-applicable',totalVotes:null,requiredVotes:null,worstRemainingVotes:null,worstRemainingWorkers:null,assumptions:[]}
    if(v.strategy==='resourcepool'){
      let known=unique&&resolved.length===links.length&&workers.length>0
      const resourceIds=new Set<string>()
      for(const {component:c}of resolved)if(c.hostingDetails.resourceId){
        const identity=[c.hosting,norm(c.hostingDetails.providerEndpoint),norm(c.hostingDetails.resourceId)].join(':')
        if(resourceIds.has(identity)){add('SCOM_POOL_DUPLICATE_SERVER','Two pool participants identify the same provider resource; they cannot supply independent votes.','strategy');known=false}
        resourceIds.add(identity)
      }
      if(new Set(resolved.map(r=>norm(r.component.productDetails.managementGroup))).size>1||resolved.some(r=>!norm(r.component.productDetails.managementGroup))){add('SCOM_POOL_MANAGEMENT_GROUP','All members and observers must belong to the same explicit management group.','strategy');known=false}
      for(const {component:c,link} of resolved){
        if(c.product!=='scom'||!['management','gateway'].includes(String(c.productDetails.role))){add('SCOM_POOL_ROLE','Pool members and observers must be SCOM management or gateway roles.','role','error',c.id,'products');known=false}
        if(!releaseLabel(c.version,'2025')){add('SCOM_POOL_VERSION','Obtain a pool-voting review for this exact SCOM release; this calculation uses the 2025 documentation.','version','warning',c.id,'management');known=false}
        if(!c.failureDomain.trim()){add('SCOM_POOL_DOMAIN','Record the correlated failure domain for every member and observer.','failureDomain','error',c.id);known=false}
        if(link.values.role!=='active'&&link.values.role!=='observer'){add('SCOM_POOL_MEMBER_ROLE','Pool workload members must be active; a voting-only participant is an observer.','role','error',link.id);known=false}
      }
      if(!v.poolWorkload)add('SCOM_POOL_WORKLOAD','Choose the pool workload.','poolWorkload')
      if(v.poolWorkload==='windows')add('SCOM_WINDOWS_AGENT_POOL','Windows agents report to management/gateway servers, not resource pools.','poolWorkload')
      if(v.poolWorkload==='other')add('SCOM_POOL_WORKLOAD_REVIEW','Qualify this workload against the selected pool and management packs.','poolQualification','warning')
      if(!v.poolQualification)add('SCOM_POOL_QUALIFICATION','Record membership, dedicated-workload and certificate review.','poolQualification','warning')
      const latency=String(v.poolLatencyMs||'').trim()
      if(!latency)add('SCOM_POOL_LATENCY','Record reviewed inter-member latency.','poolLatencyMs','warning')
      else if(!/^\d+(?:\.\d+)?$/.test(latency)||!Number.isFinite(Number(latency)))add('SCOM_POOL_LATENCY','Use a non-negative numeric latency in milliseconds.','poolLatencyMs')
      else if(Number(latency)>=10)add('SCOM_POOL_LATENCY','The reviewed design recommends inter-member latency below 10 ms.','poolLatencyMs','warning')
      if(!v.defaultObserver){add('SCOM_DEFAULT_OBSERVER','Record whether the database default observer is enabled; console and PowerShell creation defaults differ.','defaultObserver');known=false}
      const votes=resolved.map(r=>({domain:placement.domains.get(r.component.id)||norm(r.component.failureDomain),worker:r.link.values.role!=='observer'}))
      if(v.defaultObserver==='enabled'){
        const sql=components.get(String(v.observerDatabase))
        if(resolved.some(r=>r.component.productDetails.role==='gateway')){add('SCOM_GATEWAY_OBSERVER','Gateway servers cannot use the database default observer. Use an explicitly reviewed pool voting design.','defaultObserver');known=false}
        if(sql?.product!=='sql'){add('SCOM_OBSERVER_DATABASE','Link the operational database SQL service used by the default observer.','observerDatabase');known=false}
        if(!v.observerFailureDomain||!v.observerSite||!v.observerEvidence){add('SCOM_OBSERVER_EVIDENCE','Record the observer failure domain, site and operational database dependency evidence.','observerEvidence');known=false}
        if(v.observerSite&&resolved.some(r=>r.link.values.site&&r.link.values.site!==v.observerSite))add('SCOM_OBSERVER_SITE','The database observer is outside a member site; review the full voting and failure scope.','observerSite','warning')
        votes.push({domain:placement.labels.get(norm(v.observerFailureDomain))||norm(v.observerFailureDomain),worker:false})
      }
      const lost=Number(v.failureDomainsLost),minimum=Number(v.minimumActive)
      if(!Number.isInteger(lost)||lost<1||!Number.isInteger(minimum)||minimum<1)known=false
      if(known){
        const domains=new Map<string,{votes:number;workers:number}>()
        for(const vote of votes){const count=domains.get(vote.domain)||{votes:0,workers:0};count.votes++;if(vote.worker)count.workers++;domains.set(vote.domain,count)}
        const totalVotes=votes.length,requiredVotes=Math.floor(totalVotes/2)+1
        const worstRemainingVotes=totalVotes-[...domains.values()].map(d=>d.votes).sort((a,b)=>b-a).slice(0,lost).reduce((a,b)=>a+b,0)
        const worstRemainingWorkers=workers.length-[...domains.values()].map(d=>d.workers).sort((a,b)=>b-a).slice(0,lost).reduce((a,b)=>a+b,0)
        const sufficient=worstRemainingVotes>=requiredVotes&&worstRemainingWorkers>=minimum
        voting={status:sufficient?'consistent':'insufficient',totalVotes,requiredVotes,worstRemainingVotes,worstRemainingWorkers,assumptions:['Static majority of declared votes; no runtime health inferred.','Default observer evidence and correlated failure domains are operator assertions.','Worst surviving votes and workload members are independently bounded across the requested domain losses.']}
        if(!sufficient)add('SCOM_POOL_QUORUM','Declared failure-domain loss cannot retain both a voting majority and the required workload members.','defaultObserver')
      }else voting={...voting,status:'unknown',assumptions:['Incomplete or unqualified voting inputs; no quorum capacity is inferred.']}
    }
    return {groupId:group.id,name,product:v.product,strategy:v.strategy,inputs:{...v},members:resolved.map(r=>({componentId:r.component.id,name:r.component.name,role:r.link.values.role,productRole:r.component.productDetails.role||'',site:r.link.values.site||'',failureDomain:r.component.failureDomain})),voting,details,findings,runtimeQualified:false,sources:[...details.sources,...(v.strategy==='resourcepool'?[AVAILABILITY_SOURCES.scom,AVAILABILITY_SOURCES.observers]:v.strategy==='servicecluster'?[AVAILABILITY_SOURCES.vmm]:[])]}
  })
  const findings=groups.flatMap(g=>g.findings)
  const componentSites=new Map<string,Set<string>>()
  for(const member of project.design.availabilityMembers)if(member.values.component&&member.values.site){const key=String(member.values.component),sites=componentSites.get(key)||new Set<string>();sites.add(String(member.values.site));componentSites.set(key,sites)}
  for(const member of project.design.availabilityMembers)if((componentSites.get(String(member.values.component))?.size||0)>1)findings.push({code:'HA_MEMBER_SITE_CONFLICT',section:'hosting',recordId:member.id,fieldKey:'site',severity:'error',message:'The same component has conflicting site assignments across its availability memberships.'})
  return {kind:'hyperv-availability-assessment',version:'0.2.0',reviewedAt:'2026-09-11',projectId:project.id,revision:project.revision,meaning:'Application roles, declared failure domains and site recovery are reviewed independently from provider restart protection. Consistent arithmetic is not proof of support, admission capacity, quorum health, recovery or execution.',groups,findings}
}
