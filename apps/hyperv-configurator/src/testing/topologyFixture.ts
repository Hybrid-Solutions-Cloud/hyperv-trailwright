import {networkControlsFixture} from './networkControlsFixture'
import {newComponent} from '../project'
export function topologyFixture(){
 const f=networkControlsFixture(),{project,add}=f;project.name='Joined topology example'
 add('sites','site-main',{name:'Example primary site'});project.design.clusters[0].values.site='site-main'
 const vmm=newComponent('vmm');vmm.id='service-vmm';vmm.name='Example VMM service';vmm.owner='Example management team';project.components.push(vmm)
 const sql=newComponent('sql');sql.id='service-sql';sql.name='Example SQL service';sql.owner='Example database team';project.components.push(sql)
 add('dependencies','service-dependency',{prerequisite:sql.id,dependent:vmm.id,phase:'bootstrap'})
 add('managementNetworks','vmm-network',{name:'VMM management attachment',component:vmm.id,network:'management-net',addressing:'static',ip:'192.0.2.13/24'})
 add('availabilityGroups','service-group',{name:'Example service HA',strategy:'servicecluster'})
 add('availabilityMembers','service-placement',{name:'VMM physical placement',group:'service-group',component:vmm.id,physicalHost:'host-net-1',placementMode:'pinned',placementBasis:'desired'})
 add('storageSystems','local-system',{name:'Example local datastore',kind:'local',cluster:'cluster-net',localHost:'host-net-1'})
 add('volumes','local-volume',{name:'Example local volume',system:'local-system',sizeGiB:500,path:'D:\\VMs',provisioning:'fixed'})
 add('storagePaths','local-directory',{name:'Example VM disk folder',volume:'local-volume',path:'D:\\VMs\\Management',purpose:'disks'})
 add('storageAllocations','vmm-disk',{name:'VMM OS disk',resource:vmm.id,directory:'local-directory',diskKey:'os',sizeGiB:80,usedGiB:30,provisioning:'dynamic'})
 add('stages','prepare-stage',{name:'Prepare hosts',kind:'host',targets:'host-net-1 host-net-2',executor:'operator',status:'planned'})
 add('stages','management-stage',{name:'Install management',kind:'management',targets:vmm.id,dependsOn:'prepare-stage',executor:'operator',status:'planned'})
 return {...f,vmm,sql}
}
