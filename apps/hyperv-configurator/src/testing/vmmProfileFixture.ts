import { collections, newRecord } from '../catalog'
import { vmmFixture } from './vmmFixture'

export function vmmProfileFixture() {
  const fixture = vmmFixture(), {project,profile,host} = fixture
  project.name='Profile creation example';project.owner='Example operator'
  const media = newRecord(collections.find(c=>c.key==='media')!)
  media.id='image-a';media.values={...media.values,name:'Generalized host image',owner:'Image operator',kind:'vhdx',version:'Reviewed test build',source:'https://artifacts.example.test/host.vhdx',sha256:'a'.repeat(64)}
  project.design.media.push(media)
  Object.assign(profile.values,{owner:'Profile operator',profileState:'create',profileRef:'',image:media.id,os:'ws2025',installType:'core',libraryPath:'\\\\library.example.test\\images\\host.vhdx',locale:'en-US',activation:'Existing volume activation service',
    virtualHardDiskId:'66666666-6666-6666-6666-666666666666',vhdConversion:'fixed',joinMode:'domain',profileDomain:'example.test',domainJoinRunAsId:'77777777-7777-7777-7777-777777777777',localAdminCredentialRef:'secret-ref://example/local-admin',networkAdapterProfileIds:'88888888-8888-8888-8888-888888888888',networkAdapterReview:'Example operator review: management NIC by CDN, logical switch owner VMM.',
    partitionStyle:'mbr',diskConfiguration:'MBR=1:PRIMARY:QUICK:4:FALSE:OS::0:BOOTPARTITION;',diskConfigurationEvidence:'Synthetic fixture layout; no hardware qualification claimed.',vmPaths:'C:\\VirtualMachines',driverSelection:'pnp',timeZoneId:'0',profileAcceptance:'Read back returned profile GUID and compare reviewed settings before host authorization.'})
  Object.assign(host.values,{boot:'bios',bootDisk:'Example OS RAID virtual disk',partitionLayout:'Example BIOS layout review'})
  return {...fixture,media}
}
