import { collections, newRecord, type Answers } from '../catalog'
import { newProject } from '../project'

export function storageFixture() {
  const project = newProject()
  project.name='Storage example'; project.owner='Example storage team'; project.scope='cluster'; project.environment='lab'
  const add = (key:string,id:string,values:Answers) => {
    const row = newRecord(collections.find(c=>c.key===key)!);row.id=id;Object.assign(row.values,{name:id,owner:project.owner},values);if(key==='volumes')row.values.lifecycle='create';project.design[key].push(row);return row
  }
  const cluster=add('clusters','cluster-a',{name:'Example cluster',os:'ws2025',edition:'datacenter',topology:'cluster'})
  for(let i=1;i<=3;i++) {
    const host=add('hosts',`host-${i}`,{name:`example-hv0${i}`,cluster:cluster.id})
    add('disks',`boot-${i}`,{host:host.id,role:'boot',media:'ssd',count:2,sizeGiB:256})
    add('disks',`cache-${i}`,{host:host.id,role:'cache',media:'nvme',count:2,sizeGiB:512})
    add('disks',`capacity-${i}`,{host:host.id,role:'capacity',media:'ssd',count:4,sizeGiB:2048})
  }
  const pool=add('storageSystems','s2d-a',{name:'Example S2D',cluster:cluster.id,kind:'s2d',rawTiB:24,usableTiB:8,reserveTiB:1,diskEligibility:'Example reviewed direct-attached hardware; production validation pending'})
  const fixed=add('volumes','fixed-a',{name:'Fixed CSV',system:pool.id,path:'C:\\ClusterStorage\\Fixed',filesystem:'refs',provisioning:'fixed',resiliency:'mirror3',sizeGiB:2048,usedGiB:512})
  const thin=add('volumes','thin-a',{name:'Thin CSV',system:pool.id,path:'C:\\ClusterStorage\\Thin',filesystem:'refs',provisioning:'thin',resiliency:'mirror3',sizeGiB:8192,usedGiB:1024,policy:'Example alert at 70 percent; storage owner expands before growth'})
  const san=add('storageSystems','san-a',{name:'Example SAN',cluster:cluster.id,kind:'fc',rawTiB:40,usableTiB:12,reserveTiB:2,endpoint:'array.example.test',vendor:'Example array',version:'Reviewed firmware',mpio:'Vendor DSM policy reviewed',fabrics:'Independent A/B fabrics and exact WWPN zones reviewed',recovery:'Vendor support and recovery review'})
  add('volumes','san-volume',{name:'SAN CSV',system:san.id,path:'C:\\ClusterStorage\\SAN',lunId:'example-lun-1',filesystem:'ntfs',provisioning:'fixed',resiliency:'external',sizeGiB:4096,usedGiB:1024,hostMapping:'Exact example host group and LUN mapping'})
  return {project,add,cluster,pool,fixed,thin,san}
}
