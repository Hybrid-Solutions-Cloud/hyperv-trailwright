import {sha256} from 'js-sha256'
import {validTime} from './discoveryContract'

export interface SdnResult {id:string;scenario:string;targetIds:string[];status:'passed'|'failed'|'not-run';expected:string;observed:string;evidenceRef:string}
export interface SdnEvidence {kind:'hyperv-sdn-evidence';schemaVersion:1;id:string;projectId:string;scopeHash:string;observedAt:string;source:{operator:string;runner:string;version:string;endpoint:string};results:SdnResult[]}
export interface SdnEvidenceEntry {evidence:SdnEvidence;original:string;sha256:string;fileName:string;importedAt:string}
export interface SdnEvidenceState {entries:SdnEvidenceEntry[]}
export const SDN_EVIDENCE_LIMIT=512*1024
export const SDN_SCENARIOS=['east-west','isolation','north-south','vip-nat','bgp','failover']
export const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item)
const object=(value:unknown,keys:string[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))throw new Error('Invalid SDN evidence object fields.')}
const text=(value:unknown,max=2000,blank=false)=>{if(typeof value!=='string'||value.length>max||(!blank&&!value.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error('Invalid SDN evidence text.')}
const hash=(value:unknown)=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new Error('Invalid SDN SHA-256.')}
function reference(value:string){
 let url:URL|undefined;try{url=new URL(value)}catch{/* Plain artifact identifiers are accepted. */}
 if(url&&(url.username||url.password||[...url.searchParams.keys()].some(k=>/^(sig|token|access_token|client_secret|password)$/i.test(k))))throw new Error('Evidence references must not contain credentials or signed access tokens.')
}
export function validateSdnEvidence(value:unknown):asserts value is SdnEvidence{
 object(value,['kind','schemaVersion','id','projectId','scopeHash','observedAt','source','results']);const v=value as SdnEvidence
 if(v.kind!=='hyperv-sdn-evidence'||v.schemaVersion!==1)throw new Error('Unsupported SDN evidence contract.')
 text(v.id,256);text(v.projectId,256);hash(v.scopeHash)
 if(!validTime(v.observedAt))throw new Error('SDN observation time must be a valid UTC timestamp.')
 object(v.source,['operator','runner','version','endpoint']);for(const val of Object.values(v.source))text(val);reference(v.source.endpoint)
 if(!Array.isArray(v.results)||v.results.length<1||v.results.length>1000)throw new Error('SDN evidence needs 1–1000 result records.')
 const ids=new Set<string>()
 for(const row of v.results){
  object(row,['id','scenario','targetIds','status','expected','observed','evidenceRef']);text(row.id,256)
  if(ids.has(row.id))throw new Error('Duplicate SDN result ID.');ids.add(row.id)
  if(!SDN_SCENARIOS.includes(row.scenario)||!['passed','failed','not-run'].includes(row.status))throw new Error('Invalid SDN result scenario or status.')
  if(!Array.isArray(row.targetIds)||!row.targetIds.length||row.targetIds.length>1000||new Set(row.targetIds).size!==row.targetIds.length)throw new Error('SDN results require unique target IDs.')
  row.targetIds.forEach(id=>text(id,256));text(row.expected,8000);text(row.observed,8000,row.status==='not-run');text(row.evidenceRef,2000,row.status==='not-run');reference(row.evidenceRef)
 }
 if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|token|client_secret|connection_string)\s*[:=]\s*(?!keyvault:\/\/|secret-ref:\/\/)[^\s"]+/i.test(JSON.stringify(v)))throw new Error('Remove secret literals from SDN evidence.')
}
export function validateSdnEvidenceState(value:unknown,projectId:string):asserts value is SdnEvidenceState{
 object(value,['entries']);const state=value as SdnEvidenceState
 if(!Array.isArray(state.entries)||state.entries.length>20)throw new Error('Keep at most 20 SDN evidence imports in one project.')
 const ids=new Set<string>(),hashes=new Set<string>()
 for(const entry of state.entries){
  object(entry,['evidence','original','sha256','fileName','importedAt']);validateSdnEvidence(entry.evidence);text(entry.original,SDN_EVIDENCE_LIMIT);text(entry.fileName,256);hash(entry.sha256)
  if(new TextEncoder().encode(entry.original).length>SDN_EVIDENCE_LIMIT||sha256(entry.original)!==entry.sha256)throw new Error('Stored SDN source bytes do not match their SHA-256.')
  let parsed:unknown;try{parsed=JSON.parse(entry.original.replace(/^\uFEFF/,''))}catch{throw new Error('Stored SDN source is not valid JSON.')}
  if(canonical(parsed)!==canonical(entry.evidence))throw new Error('Stored SDN results disagree with the original source file.')
  if(entry.evidence.projectId!==projectId)throw new Error('SDN evidence belongs to another project.')
  if(!validTime(entry.importedAt)||Date.parse(entry.evidence.observedAt)>Date.parse(entry.importedAt)||Date.parse(entry.importedAt)>Date.now()+300000)throw new Error('Invalid SDN evidence import or observation time.')
  if(ids.has(entry.evidence.id)||hashes.has(entry.sha256))throw new Error('SDN evidence import IDs and hashes must be unique.')
  ids.add(entry.evidence.id);hashes.add(entry.sha256)
 }
}
