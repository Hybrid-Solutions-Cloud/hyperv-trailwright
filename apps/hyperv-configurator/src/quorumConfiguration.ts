import type { Project } from './project'
import type { Finding } from './validation'

export const quorumFields=['quorumAction','witnessSharePath','witnessShareIdentity','witnessAuthRef','witnessAccountName','witnessEndpoint','witnessDiskResourceId','witnessDiskVolume','witnessPlacement','witnessPrerequisites','witnessAcceptance'] as const
const s=(v:unknown)=>String(v??'').trim()
const dns=(v:string)=>v.length<=253 && v.includes('.') && !/^[\d.]+$/.test(v) && v.split('.').every(x=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(x))
export function quorumConfiguration(project:Project){
  const findings:Finding[]=[]
  const add=(id:string,code:string,message:string)=>findings.push({code:`quorum-${code}`,section:'topology',recordId:id,severity:'error',message})
  const clusters=project.design.clusters.filter(c=>c.values.quorumAction==='configure')
  const targets=[...clusters].sort((a,b)=>a.id.localeCompare(b.id)).map(c=>{
    const v=c.values
    const nodes=project.design.hosts.filter(h=>h.values.cluster===c.id).sort((a,b)=>a.id.localeCompare(b.id)).map(h=>({id:h.id,name:s(h.values.name),fqdn:s(h.values.fqdn).toLowerCase(),smbiosGuid:s(h.values.uuid).toLowerCase()}))
    const target={id:c.id,name:s(v.name),fqdn:s(v.fqdn).toLowerCase(),domainFqdn:s(v.domainFqdn).toLowerCase(),moduleVersion:s(v.clusterModuleVersion),osBuild:s(v.build),seedHostId:s(v.seedHost),nodes,witness:{type:s(v.witness),sharePath:v.witness==='file'?s(v.witnessSharePath):'',shareIdentity:v.witness==='file'?s(v.witnessShareIdentity):'',authRef:v.witness==='cloud'||(v.witness==='file'&&v.witnessShareIdentity==='local')?s(v.witnessAuthRef):'',accountName:v.witness==='cloud'?s(v.witnessAccountName):'',endpoint:v.witness==='cloud'?s(v.witnessEndpoint).toLowerCase():'',diskResourceId:v.witness==='disk'?s(v.witnessDiskResourceId).toLowerCase():'',diskVolumeId:v.witness==='disk'?s(v.witnessDiskVolume):'',placement:v.witness==='none'?'':s(v.witnessPlacement),prerequisites:v.witness==='none'?'':s(v.witnessPrerequisites),acceptance:s(v.witnessAcceptance)}}
    const w=target.witness
    if(!['none','file','cloud','disk'].includes(w.type))add(c.id,'type',`${v.name}: select the intended witness type, including an explicit None choice where reviewed.`)
    if(w.type==='none'?!w.acceptance:!w.placement||!w.prerequisites||!w.acceptance)add(c.id,'review',w.type==='none'?`${v.name}: record quorum validation and failover acceptance for a design without a witness.`:`${v.name}: record failure-domain placement, prerequisite/access review and quorum/failover acceptance.`)
    if(w.type==='file'){
      const match=/^\\\\([^\\]+)\\([^\\]+)$/.exec(w.sharePath)
      if(!match||!dns(match[1])||!/^[-a-z\d_$ .]{1,80}$/i.test(match[2])||['.','..'].includes(match[2])||/[ .]$/.test(match[2])||nodes.some(n=>n.fqdn===match[1].toLowerCase())||target.fqdn===match[1].toLowerCase())add(c.id,'share',`${v.name}: use a dedicated UNC share on a host outside this cluster; no subdirectories or DFS path.`)
    }
    if(w.type==='cloud'){
      if(!/^[a-z\d]{3,24}$/.test(w.accountName)||!['core.windows.net','core.usgovcloudapi.net','core.chinacloudapi.cn'].includes(w.endpoint))add(c.id,'cloud',`${v.name}: enter the storage account name and an explicit supported Azure service suffix.`)
      if(!/^(keyvault|secret-ref):\/\/[^\s]+$/.test(w.authRef))add(c.id,'secret',`${v.name}: supply a runtime keyvault:// or secret-ref:// access-key reference, never an access key.`)
    }
    if(w.type==='disk'){
      const volume=project.design.volumes.find(x=>x.id===w.diskVolumeId),system=project.design.storageSystems.find(x=>x.id===volume?.values.system)
      if(!volume||!system||system.values.cluster!==c.id||!['fc','iscsi'].includes(s(system.values.kind))||!['ntfs','refs'].includes(s(volume.values.filesystem))||Number(volume.values.sizeGiB)<=0.5||Number(volume.values.usedGiB)!==0)add(c.id,'disk',`${v.name}: select a dedicated unused shared SAN volume above 512 MiB (NTFS/ReFS) and its storage reference. Storage presentation and access still require review.`)
    }
    return target
  })
  const seen=new Set<string>()
  for(const t of targets){
    for(const row of [t,...t.nodes])for(const key of ['id','name','fqdn'] as const){const value=row[key].toLowerCase(),identity=`${key}/${value}`;if(value&&seen.has(identity))add(t.id,'duplicate',`Quorum targets duplicate ${key}: ${value}.`);if(value)seen.add(identity)}
    for(const n of t.nodes){const id=`uuid/${n.smbiosGuid}`;if(n.smbiosGuid&&seen.has(id))add(t.id,'duplicate','Quorum targets reuse a node SMBIOS identity.');seen.add(id)}
    if(t.witness.type==='file'){const id=`share/${t.witness.sharePath.toLowerCase()}`;if(seen.has(id))add(t.id,'share-reuse','Each cluster needs its own dedicated witness share.');seen.add(id)}
  }
  return {kind:'hyperv-quorum-configuration',schemaVersion:1,projectId:project.id,projectRevision:project.revision,status:!clusters.length?'not-selected':findings.length?'needs-review':'design-handoff',targets,findings}
}
