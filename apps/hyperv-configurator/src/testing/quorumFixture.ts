import { collections,newRecord } from '../catalog'
import { clusterFixture } from './clusterFixture'
export function quorumFixture(type='file'){
  const fixture=clusterFixture(),{project,cluster}=fixture
  project.scope='cluster';project.name='Quorum example'
  Object.assign(cluster.values,{intent:'handoff',startingState:'existing',lifecycle:'configure',quorumAction:'configure',witness:type,witnessSharePath:'\\\\witness.example.test\\example-cl$',witnessShareIdentity:'domain',witnessPlacement:'Independent example failure domain',witnessPrerequisites:'Reviewed dedicated resources and access in the fictional fixture',witnessAcceptance:'Review quorum validation and node/site/witness failure cases'})
  if(type==='cloud')Object.assign(cluster.values,{witnessAccountName:'examplewitness',witnessEndpoint:'core.windows.net',witnessAuthRef:'secret-ref://example/witness-key'})
  if(type==='disk'){
    const system=newRecord(collections.find(c=>c.key==='storageSystems')!);system.id='san-a';Object.assign(system.values,{name:'Example SAN',cluster:cluster.id,kind:'fc'});project.design.storageSystems.push(system)
    const volume=newRecord(collections.find(c=>c.key==='volumes')!);volume.id='witness-volume';Object.assign(volume.values,{name:'Dedicated witness',system:system.id,sizeGiB:1,usedGiB:0,filesystem:'ntfs'});project.design.volumes.push(volume)
    Object.assign(cluster.values,{witnessDiskResourceId:'33333333-3333-3333-3333-333333333333',witnessDiskVolume:volume.id})
  }
  return fixture
}
