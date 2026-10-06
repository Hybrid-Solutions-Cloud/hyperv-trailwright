import {newProject} from '../project'
import {collections,newRecord,type Answers} from '../catalog'
export function sdnFixture(){
 const project=newProject();project.id='sdn-example';project.name='Example SDN fabric';project.owner='Example design team'
 const add=(key:string,id:string,values:Answers)=>{const r=newRecord(collections.find(c=>c.key===key)!);r.id=id;Object.assign(r.values,{name:id,owner:'Example team'},values);project.design[key].push(r);return r}
 Object.assign(project.sdn,{scope:'new',architecture:'host-cluster-role',owner:'powershell',osVersion:'Windows Server 2025 Datacenter build 26100 (example)',toolVersion:'SdnExpress 1.1.245',controllerEndpoint:'https://nc.example.test',certificates:'EXAMPLE certificate design',recovery:'EXAMPLE recovery acceptance'})
 add('clusters','sdn-cluster',{topology:'cluster',os:'ws2025',name:'Example controller cluster'})
 add('networks','sdn-management',{purpose:'management',cidr:'192.0.2.0/24',gateway:'192.0.2.1',routingScope:'fabric'})
 add('networks','sdn-provider',{purpose:'provider',cidr:'198.51.100.0/24',routingScope:'provider'})
 for(const [id,kind]of [['sdn-domain','domain'],['sdn-service','service'],['sdn-runner','runner'],['sdn-pki','pki']])add('identities',id,{kind})
 add('storageSystems','sdn-storage',{kind:'s2d',cluster:'sdn-cluster'});add('volumes','sdn-db',{system:'sdn-storage'})
 Object.assign(project.sdn.details,{controllerRelease:'ws2025',controllerBuild:'26100',deploymentTool:'sdnexpress',deploymentToolBuild:'1.1.245',intent:'handoff',isolation:true,controllerCluster:'sdn-cluster',managementNetwork:'sdn-management',providerNetwork:'sdn-provider',restIp:'192.0.2.10',restName:'nc.example.test',macPoolStart:'02-00-00-00-00-10',macPoolEnd:'02-00-00-00-00-FF',domainIdentity:'sdn-domain',controllerIdentity:'sdn-service',runnerIdentity:'sdn-runner',certificateIdentity:'sdn-pki',sharedVolume:'sdn-db',databasePath:'C:\\ClusterStorage\\Volume1\\NCDB',binaryPath:'C:\\ClusterStorage\\Volume1\\NCBin',changeScope:'EXAMPLE new controller fabric',compatibilityEvidence:'EXAMPLE design source review; native qualification pending',physicalAcceptance:'EXAMPLE physical routing and MTU acceptance',availability:'EXAMPLE two-node host-controller placement',monitoring:'EXAMPLE health ownership'})
 for(let i=1;i<=2;i++){
  add('hosts',`sdn-host-${i}`,{cluster:'sdn-cluster',currentOsBuild:'Windows Server 2025'});add('hostSwitches',`sdn-switch-${i}`,{host:`sdn-host-${i}`})
  add('sdnResources',`sdn-overhead-${i}`,{role:'hostcontroller',cluster:'sdn-cluster',host:`sdn-host-${i}`,lifecycle:'create',lifecycleOwner:'powershell',failureDomain:`Example rack ${i}`,managementNetwork:'sdn-management',vCpu:2,memoryGiB:4,diskGiB:20,prerequisites:'EXAMPLE roles and restart review'})
  add('sdnHostBindings',`sdn-binding-${i}`,{host:`sdn-host-${i}`,hostSwitch:`sdn-switch-${i}`,providerNetwork:'sdn-provider',lifecycleOwner:'powershell',preservation:'EXAMPLE preserve host switch',readiness:'EXAMPLE host prerequisites',connectivity:'EXAMPLE physical acceptance'})
 }
 return {project,add}
}
