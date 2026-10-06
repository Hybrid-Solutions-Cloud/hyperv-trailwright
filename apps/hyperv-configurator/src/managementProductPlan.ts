import type {Project,Component} from './project'
import type {Finding} from './validation'
import {managementProductFields,managementSystemFields} from './managementProductFields'
import {releaseLabel,SUPPORT_SOURCES} from './supportCatalog'
import {additionalProductFields} from './hostingContractFields'

export function managementProductPlan(project:Project){
  const components=project.components.filter(c=>c.product!=='ome').map(c=>{
    const v=c.productDetails,findings:Finding[]=[],name=c.name||c.product
    const selected=c.hostingDetails.installProduct||c.hostingDetails.integrateProduct
    const add=(code:string,message:string,key:string,severity:Finding['severity']=selected?'error':'warning')=>findings.push({code,section:'products',recordId:c.id,fieldKey:key,severity,message:name+': '+message})
    const require=(keys:string[])=>{for(const key of keys)if(!String(v[key]||'').trim()){const field=[...managementSystemFields,...(managementProductFields[c.product]||[]),...(additionalProductFields[c.product]||[])].find(f=>f.key===key);add('PRODUCT_INPUT','Record '+(field?.label||key)+'.',key)}}
    if(c.hosting!=='external')require(['osRelease','osEdition','osInstallType','osEvidence'])
    if(String(v.osRelease).startsWith('ws')&&(['pro','enterprise'].includes(String(v.osEdition))||v.osInstallType==='client'))add('PRODUCT_OS_COMBINATION','Windows Server release conflicts with the selected client edition or installation type.','osEdition','error')
    if(['win10','win11'].includes(String(v.osRelease))&&(['standard','datacenter'].includes(String(v.osEdition))||['core','desktop'].includes(String(v.osInstallType))))add('PRODUCT_OS_COMBINATION','Windows client release conflicts with the selected Server edition or installation type.','osEdition','error')
    if(['vmm','scom'].includes(c.product))require(['role'])
    const role=String(v.role||'')
    if(c.product==='vmm'&&role==='service'){
      const identityLinks=project.design.identityBindings.filter(r=>r.values.resource===c.id&&r.values.usage==='service')
      const serviceIdentity=identityLinks.length===1?project.design.identities.find(r=>r.id===identityLinks[0].values.identity):undefined
      const managedIdentity=serviceIdentity?.values.kind==='gmsa'||(serviceIdentity?.values.kind==='service'&&serviceIdentity.values.accountScope==='localSystem')
      require(['serviceTopology','serviceEndpoint',...managedIdentity?[]:['serviceCredentialRef'],'sqlComponent','sqlInstance','databaseName','libraryComponents','libraryAccess','adkBuild','winpeBuild','fabricDelegation','roleAcceptance'])
      if(v.serviceTopology==='clustered')require(['serviceAddress','dkmPermissions'])
      if(releaseLabel(c.version,'2025')&&v.osRelease&&v.osRelease!=='ws2025')add('VMM_SERVICE_OS','The reviewed VMM 2025 management-server baseline requires Windows Server 2025.','osRelease',v.osRelease==='other'?'warning':'error')
      if(v.serviceTopology==='clustered'&&(!v.serviceName||!v.dkm||!(v.serviceAccount||serviceIdentity?.values.account)))add('VMM_SERVICE_CLUSTER','A clustered service needs its shared service name, DKM and service identity.','serviceTopology','error')
    }
    if(c.product==='scom'&&role){
      const required:Record<string,string[]>={management:['managementServers','poolMembership','operationalSql','warehouseSql','actionCredentialRef','readerCredentialRef','writerCredentialRef','agentDeployment'],gateway:['managementServers','gatewayTrust'],web:['managementServers','webEndpoint'],reporting:['warehouseSql','reportingEndpoint'],console:['managementServers'],acs:['acsDesign']}
      require([...(required[role]||[]),'roleAcceptance'])
      if(releaseLabel(c.version,'2025')){
        const osOptions=role==='console'?['ws2022','ws2025','win10','win11']:['ws2022','ws2025']
        if(v.osRelease&&!osOptions.includes(String(v.osRelease)))add('SCOM_ROLE_OS','This OS is outside the reviewed SCOM 2025 role baseline; Windows client support is specific to the Operations console.','osRelease',v.osRelease==='other'?'warning':'error')
        if(v.osInstallType==='core'&&!['management','gateway'].includes(role))add('SCOM_CORE_ROLE','This role is outside the reviewed SCOM Server Core management/gateway baseline.','osInstallType','error')
      }
      if(v.additionalRoles)add('SCOM_COLOCATION','Review every co-located role against its OS, prerequisites and recovery requirements.','additionalRoles','warning')
    }
    if(c.product==='sql'){
      require(['engineHost','authenticationMode','serviceCredentialRef','databaseMap','enginePort','patchLevel','storageLayout','editionEvidence','roleAcceptance'])
      if(v.topology==='ag'||v.topology==='fci')require(['haEndpoint','replicaPlacement'])
      if(v.engineHost==='external')add('SQL_EXTERNAL_QUALIFICATION','Qualify the exact external SQL service against every consuming management product.','engineHost','warning')
      if(v.edition==='standard'&&v.topology==='ag')add('SQL_STANDARD_AG_REVIEW','Confirm Standard edition limits for the actual database count, replicas and consuming product; an AG label alone does not establish support.','editionEvidence','warning')
    }
    if(c.product==='wac'){
      require(['deploymentTopology','gatewayBuild','delegationEvidence','roleAcceptance'])
      if(v.mode==='virtualization'){
        require(['modeIsolation'])
        if(v.deploymentTopology&&v.deploymentTopology!=='virtualization')add('WAC_MODE_TOPOLOGY','Virtualization Mode requires its dedicated gateway topology.','deploymentTopology','error')
        if(v.osRelease&&v.osRelease!=='ws2025')add('WAC_VIRTUAL_OS','Select the reviewed Windows Server 2025 gateway baseline or obtain evidence for another release.','osRelease',v.osRelease==='other'?'warning':'error')
        const cores=c.hosting==='physical'?Number(v.physicalCores||0):c.vCpu
        if(c.hosting!=='external'&&(cores<4||c.memoryGiB<8))add('WAC_VIRTUAL_CAPACITY','The reviewed Virtualization Mode gateway minimum is 4 CPUs and 8 GiB memory. Review provider allocations.','modeIsolation','error')
        if(c.hosting!=='external'&&Number(v.gatewayFreeDiskGiB||0)<10)add('WAC_VIRTUAL_DISK','Record at least 10 GiB free disk allowance for the dedicated gateway; allocated disk size does not establish free space.','gatewayFreeDiskGiB','error')
      }else if(v.mode==='administration'&&v.deploymentTopology==='virtualization')add('WAC_MODE_TOPOLOGY','Administration Mode and the dedicated Virtualization Mode topology are separate choices.','deploymentTopology','error')
    }
    if(c.product==='arc')require(['subscriptionId','resourceGroup','customLocation','bridgeResource','bridgeBuild','vmmExtensionBuild','identityScope','bridgeCapacity','roleAcceptance'])
    if(c.product==='runner')require(['runnerEndpoint','credentialRef','artifactTrust','receiptContract'])
    if(['identity','pki','library','pxe'].includes(c.product))require(['roleAcceptance'])
    if(c.product==='admin')require(['access','roles','tools','roleAcceptance'])
    if(c.product==='backup')require(['engine','repository','scope','schedule','roleAcceptance'])
    if(c.product==='patching')require(['engine','scope','rings','roleAcceptance'])
    if(c.product==='integration')require(['vendor','endpoint','version','credentialRef','scope','support','roleAcceptance'])
    const fields=[...managementSystemFields,...(managementProductFields[c.product]||[]),...(additionalProductFields[c.product]||[])]
    const references:Partial<Record<Component['product'],string[]>>={vmm:[SUPPORT_SOURCES.vmm,SUPPORT_SOURCES.vmmHa],scom:[SUPPORT_SOURCES.scom,SUPPORT_SOURCES.scomSql],wac:[SUPPORT_SOURCES.wac,SUPPORT_SOURCES.wacPreview],sql:[SUPPORT_SOURCES.vmm,SUPPORT_SOURCES.scomSql],arc:[SUPPORT_SOURCES.arc]}
    return {componentId:c.id,name,product:c.product,role,version:c.version,lifecycle:c.lifecycle,hosting:c.hosting,configurationRequested:Boolean(selected),runtimeQualified:false,inputs:Object.fromEntries(fields.map(f=>[f.key,v[f.key]??''])),findings,sources:references[c.product]||[]}
  })
  return {kind:'hyperv-management-product-plan',version:'0.1.0',projectId:project.id,revision:project.revision,meaning:'Collected configuration may include retained answers for other roles. The primary role controls required inputs; co-located roles require review. This plan does not install roles, create dependencies or certify consumer execution.',components,findings:components.flatMap(c=>c.findings)}
}
