import type {Project} from './project'
import type {Finding} from './validation'
import {collections,productFields,type Answers} from './catalog'
import {validTime} from './discoveryContract'
import {ipv4,dnsOrIpv4,cidr} from './networkAddress'
import {referenceOptions} from './references'
import {releaseLabel} from './supportCatalog'

export const PREREQUISITE_SOURCES=[
  'https://learn.microsoft.com/en-us/system-center/vmm/plan-install?view=sc-vmm-2025',
  'https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/manage-group-managed-service-accounts',
  'https://learn.microsoft.com/en-us/azure/azure-arc/system-center-virtual-machine-manager/support-matrix-for-system-center-virtual-machine-manager',
  'https://learn.microsoft.com/en-us/azure/azure-arc/resource-bridge/network-requirements',
]
const norm=(value:unknown)=>String(value||'').trim().toLowerCase()
const hash=(value:unknown)=>/^[a-f0-9]{64}$/i.test(String(value))
export function prerequisitePlan(project:Project,now=Date.now()){
  const findings:Finding[]=[]
  const add=(code:string,message:string,recordId:string,fieldKey:string,severity:Finding['severity']='error',section='identity')=>findings.push({code,message,recordId,fieldKey,severity,section})
  const required=(v:Answers,keys:string[],recordId:string,section='identity')=>{const fields=section==='products'?productFields.arc:collections.find(c=>project.design[c.key].some(r=>r.id===recordId))?.fields||[];for(const key of keys)if(!String(v[key]||'').trim())add('PREREQUISITE_INPUT',String(v.name||project.components.find(c=>c.id===recordId)?.name||'Prerequisite')+': complete '+(fields.find(f=>f.key===key)?.label||key)+'.',recordId,key,'warning',section)}
  const time=(v:Answers,key:string,id:string)=>{if(v[key]&&(!validTime(v[key])||Date.parse(String(v[key]))>now))add('PREREQUISITE_TIME','Use a valid, non-future UTC observation.',id,key)}
  const identities=project.design.identities.map(row=>{
    const v=row.values,start=findings.length
    required(v,['readinessAcceptance','reviewBasis','reviewOwner'],row.id)
    if(v.kind==='domain'){
      required(v,['forest','forestIntent','domain','dnsAuthority','objectPermissions','timeHierarchy','trustScope','recovery'],row.id)
      if(v.forestIntent==='new'&&v.lifecycle==='preserve')add('FOREST_LIFECYCLE','Preserving an existing domain cannot establish a new forest.',row.id,'forestIntent')
    }
    if(['service','gmsa'].includes(String(v.kind)))required(v,['account','serviceLogon'],row.id)
    if(v.kind==='service')required(v,['accountScope'],row.id)
    if(v.kind==='gmsa'||(v.kind==='service'&&v.accountScope==='domain'))required(v,['forest','domain'],row.id)
    if(v.kind==='gmsa')required(v,['kdsEvidence','retrievalPrincipals'],row.id)
    if(v.kind==='pki'){
      required(v,['caRole','rootAuthority','issuer','template','certificate','certificateExpiresAt','chainEvidence','enrollmentScope','renewal','recovery'],row.id)
      if(v.certificateExpiresAt&&(!validTime(v.certificateExpiresAt)||Date.parse(String(v.certificateExpiresAt))<=now))add('CERTIFICATE_EXPIRY','Certificate expiration must be a valid UTC time later than this review.',row.id,'certificateExpiresAt')
    }
    if(v.kind==='runner')required(v,['account','security','recovery'],row.id)
    if(v.reviewBasis==='observed'){required(v,['reviewedAt','reviewEvidence'],row.id);time(v,'reviewedAt',row.id)}
    for(const key of ['forest','domain'])if(v[key]&&(!dnsOrIpv4(String(v[key]))||!String(v[key]).includes('.')||ipv4(String(v[key]))!==null))add('IDENTITY_DOMAIN','Use an explicit DNS forest/domain name.',row.id,key)
    if(v.serviceComponent){const c=project.components.find(c=>c.id===v.serviceComponent);if(!c||!['identity','pki'].includes(c.product))add('IDENTITY_SERVICE','Select an active identity or PKI service component.',row.id,'serviceComponent')}
    return {recordId:row.id,name:v.name,kind:v.kind,basis:v.reviewBasis,inputs:{...v},status:findings.length>start?'review':v.reviewBasis==='observed'?'operator-observed':'planned',runtimeQualified:false}
  })
  const gmsa=new Map<string,string>()
  for(const row of project.design.identities.filter(r=>r.values.kind==='gmsa'))if(row.values.forest&&row.values.account){const key=norm(row.values.forest)+'|'+norm(row.values.account).replace(/^.*\\/,'').replace(/\$$/,'');if(gmsa.has(key))add('GMSA_DUPLICATE','A gMSA account name must be unique within its forest.',row.id,'account');gmsa.set(key,row.id)}
  const media=project.design.media.map(row=>{
    const v=row.values,start=findings.length
    required(v,['kind','version','source','sha256','acquisition','downloadOwner','integrityBasis','signaturePolicy'],row.id)
    if(v.sha256&&!hash(v.sha256))add('MEDIA_EXPECTED_HASH','Expected SHA-256 must contain 64 hexadecimal characters.',row.id,'sha256')
    if(project.requirements.offline||v.acquisition==='cache')required(v,['cache'],row.id)
    if(project.requirements.offline&&v.acquisition==='download')add('OFFLINE_MEDIA','An offline design requires a controlled cache or external delivery contract.',row.id,'acquisition')
    if(v.observedSha256&&!hash(v.observedSha256))add('MEDIA_OBSERVED_HASH','Observed SHA-256 must contain 64 hexadecimal characters.',row.id,'observedSha256')
    if(hash(v.sha256)&&hash(v.observedSha256)&&norm(v.sha256)!==norm(v.observedSha256))add('MEDIA_HASH_MISMATCH','Observed artifact bytes do not match the expected SHA-256.',row.id,'observedSha256')
    if(v.integrityBasis==='observed'){required(v,['observedSha256','verifiedAt','verificationOwner','verificationEvidence'],row.id);time(v,'verifiedAt',row.id)}
    return {recordId:row.id,name:v.name,basis:v.integrityBasis,inputs:{...v},status:findings.length>start?'review':v.integrityBasis==='observed'?'operator-observed':'planned',runtimeQualified:false}
  })
  const resources=new Set(referenceOptions(project,'$resources').map(r=>r.id))
  for(const collection of ['identityBindings','mediaBindings']){
    const seen=new Set<string>()
    for(const row of project.design[collection]){
      const v=row.values,isIdentity=collection==='identityBindings',key=isIdentity?'identity':'artifact',kind=isIdentity?'usage':'phase'
      required(v,['name','owner','resource',key,kind,isIdentity?'permissions':'acceptance'],row.id)
      if(v.resource&&!resources.has(String(v.resource)))add('PREREQUISITE_TARGET','The consuming resource is missing or omitted.',row.id,'resource')
      const target=(isIdentity?project.design.identities:project.design.media).find(r=>r.id===v[key])
      if(v[key]&&!target)add('PREREQUISITE_REFERENCE','The assigned prerequisite no longer exists.',row.id,key)
      if(target&&isIdentity){const allowed:Record<string,string[]>={directory:['domain'],service:['service','gmsa'],certificate:['pki'],runner:['runner','service','gmsa']};if(v.usage&&!allowed[String(v.usage)]?.includes(String(target.values.kind)))add('IDENTITY_USAGE','The identity kind does not match this assignment usage.',row.id,'usage')}
      if(target&&!isIdentity&&v.phase==='driver'&&target.values.kind!=='driver')add('MEDIA_USAGE','Driver injection must reference a driver artifact.',row.id,'artifact')
      const pair=String(v.resource)+'|'+String(v[key])+'|'+String(v[kind]);if(seen.has(pair))add('PREREQUISITE_DUPLICATE','This exact prerequisite assignment is duplicated.',row.id,key);seen.add(pair)
    }
  }
  const arc=project.components.filter(c=>c.product==='arc').map(c=>{
    const v=c.productDetails,start=findings.length
    required(v,['vmmComponent','azureTenant','subscriptionId','resourceGroup','region','bridgeResource','bridgeBuild','vmmExtensionBuild','providerPool','bridgeNetwork','nativeNetworkId','addressAllocation','applianceAddresses','controlPlaneAddress','outboundMode','networkAcceptance','capacityAcceptance','onboardingScope','supportReviewedAt','integrationEvidence','identityScope'],c.id,'products')
    const vmm=project.components.find(component=>component.id===v.vmmComponent)
    if(v.vmmComponent&&(!vmm||vmm.product!=='vmm'||vmm.productDetails.role!=='service'))add('ARC_VMM_REFERENCE','Arc must reference an active VMM management service.',c.id,'vmmComponent','error','products')
    if(vmm&&!['2019','2022','2025'].some(release=>releaseLabel(vmm.version,release)))add('ARC_VMM_VERSION','Qualify this VMM release against the exact Arc integration baseline.',c.id,'integrationEvidence','warning','products')
    if(v.bridgeNetwork&&!project.design.networks.some(n=>n.id===v.bridgeNetwork))add('ARC_NETWORK_REFERENCE','Select an existing bridge VM network record.',c.id,'bridgeNetwork','error','products')
    if(v.addressAllocation==='dhcp')add('ARC_STATIC_IP','The reviewed Arc-enabled VMM contract requires static address allocation.',c.id,'addressAllocation','error','products')
    if(v.addressAllocation==='pool')required(v,['nativePoolId'],c.id,'products')
    if(v.controlPlaneAddress&&ipv4(String(v.controlPlaneAddress))===null)add('ARC_CONTROL_IP','Enter the dedicated IPv4 control-plane address.',c.id,'controlPlaneAddress','error','products')
    const addresses=String(v.applianceAddresses||'').trim().split(/[\s,]+/).filter(Boolean)
    if(v.applianceAddresses&&(addresses.length<2||addresses.some(ip=>ipv4(ip)===null)))add('ARC_APPLIANCE_IPS','Enter at least two explicit IPv4 appliance and upgrade addresses, separated by commas or newlines.',c.id,'applianceAddresses','error','products')
    const combined=[...addresses,...v.controlPlaneAddress?[String(v.controlPlaneAddress)]:[]]
    if(new Set(combined).size!==combined.length)add('ARC_ADDRESS_DUPLICATE','Appliance, upgrade and control-plane addresses must be distinct.',c.id,'applianceAddresses','error','products')
    const network=project.design.networks.find(n=>n.id===v.bridgeNetwork),subnet=network&&cidr(String(network.values.cidr))
    if(subnet&&combined.some(ip=>{const value=ipv4(ip);return value!==null&&(value<subnet.first||value>subnet.last||(subnet.prefix<=30&&(value===subnet.first||value===subnet.last))||ip===network!.values.gateway)}))add('ARC_ADDRESS_SUBNET','Use available host addresses within the selected VM subnet, excluding its gateway.',c.id,'applianceAddresses','error','products')
    if(v.outboundMode==='private')add('ARC_PRIVATE_LINK','Private-link-only resource bridge deployment is outside the reviewed VMM baseline.',c.id,'outboundMode','error','products')
    if(v.outboundMode==='proxy'){
      required(v,['proxyEndpoint','noProxy','proxyCertificate'],c.id,'products')
      if(v.proxyEndpoint){try{const url=new URL(String(v.proxyEndpoint));if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.hostname.toLowerCase().endsWith('.local'))throw new Error()}catch{add('ARC_PROXY','Use an explicit HTTP(S) proxy endpoint without embedded credentials or a .local hostname.',c.id,'proxyEndpoint','error','products')}}
    }
    if(v.supportReviewedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(v.supportReviewedAt))||!validTime(String(v.supportReviewedAt)+'T00:00:00Z')||Date.parse(String(v.supportReviewedAt)+'T00:00:00Z')>now))add('ARC_REVIEW_DATE','Use a valid, non-future support review date.',c.id,'supportReviewedAt','error','products')
    return {componentId:c.id,name:c.name,inputs:{...v},status:findings.length>start?'review':'operator-reviewed',runtimeQualified:false}
  })
  for(const c of project.components){
    if(c.product==='vmm'&&c.productDetails.role==='service'){
      const bindings=project.design.identityBindings.filter(r=>r.values.resource===c.id)
      if(bindings.filter(r=>r.values.usage==='service').length>1)add('VMM_SERVICE_IDENTITY','Assign one unambiguous identity to the VMM management service.',bindings.find(r=>r.values.usage==='service')!.id,'identity')
      for(const usage of ['directory','service'])if(!bindings.some(r=>r.values.usage===usage))add('VMM_IDENTITY_ASSIGNMENT','Link the VMM service to its '+usage+' identity prerequisite.',c.id,'serviceCredentialRef','warning','products')
      for(const binding of bindings.filter(r=>r.values.usage==='service')){
        const identity=project.design.identities.find(r=>r.id===binding.values.identity)
        if(identity?.values.kind==='service'&&['local','virtual'].includes(String(identity.values.accountScope)))add('VMM_ACCOUNT_SCOPE','The reviewed VMM service accepts a domain identity or Local System for a non-HA service.',binding.id,'identity')
        if(identity?.values.accountScope==='localSystem'&&(c.productDetails.serviceTopology==='clustered'||project.design.availabilityMembers.some(m=>m.values.component===c.id&&project.design.availabilityGroups.some(g=>g.id===m.values.group&&g.values.strategy==='servicecluster'))))add('VMM_HA_ACCOUNT','A clustered VMM service cannot use Local System.',binding.id,'identity')
      }
    }
    if(c.hostingDetails.installProduct&&!project.design.mediaBindings.some(r=>r.values.resource===c.id&&r.values.phase==='install'))add('INSTALL_ARTIFACT_ASSIGNMENT','Link the selected product installation to its exact artifact.',c.id,'installProduct','warning','hosting')
  }
  for(const identity of identities)if(findings.some(f=>f.recordId===identity.recordId))identity.status='review'
  return {kind:'hyperv-prerequisite-plan',version:'0.1.0',projectId:project.id,revision:project.revision,meaning:'Prerequisite assignments and operator observations are design evidence. No credentials, artifacts or endpoints are retrieved, and no runtime qualification is inferred.',identities,media,arc,identityBindings:project.design.identityBindings,mediaBindings:project.design.mediaBindings,findings,sources:PREREQUISITE_SOURCES}
}
export function prerequisiteSchedule(project:Project){const plan=prerequisitePlan(project);return [...plan.identities.map(r=>({Resource:String(r.name),ResourceId:r.recordId,Kind:'Identity',Basis:String(r.basis),State:r.status,RuntimeQualified:'No'})),...plan.media.map(r=>({Resource:String(r.name),ResourceId:r.recordId,Kind:'Artifact',Basis:String(r.basis),State:r.status,RuntimeQualified:'No'})),...plan.arc.map(r=>({Resource:r.name,ResourceId:r.componentId,Kind:'Arc integration',Basis:'Operator design review',State:r.status,RuntimeQualified:'No'}))]}
