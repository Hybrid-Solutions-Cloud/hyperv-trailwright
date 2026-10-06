import {describe,it,expect} from 'vitest'
import {load} from 'js-yaml'
import {collections,newRecord,visibleField,type Answers} from './catalog'
import {newProject,parseProject,serializeProject,type Project} from './project'
import {demoProject} from './scenarios'
import {collectionApplies} from './collectionScope'
import {activeDecisionFields,decisionFindings} from './componentDecisions'
import {decisionGates} from './componentDecisionFields'
import {recordFields} from './availabilityDetailFields'
import {environmentFiles} from './exports'
import {validate} from './validation'
import {quorumConfiguration} from './quorumConfiguration'
import {quorumFixture} from './testing/quorumFixture'
import {removeNetworkDecisionsV31} from './testing/legacyNetworkDecisions'
import {sanitizeProject} from './sanitize'

const collection=(key:string)=>collections.find(c=>c.key===key)!
const add=(p:Project,key:string,values:Answers)=>{const row=newRecord(collection(key));Object.assign(row.values,Object.fromEntries(Object.entries(values).filter(([field])=>field in row.values)));p.design[key].push(row);return row}
const last=<T,>(rows:T[])=>rows[rows.length-1]
const keys=(p:Project,section:'network'|'operations')=>activeDecisionFields(p,section).map(f=>f.key)
const visible=(p:Project,key:string,values:Answers)=>recordFields(p,collection(key),values).filter(f=>visibleField(f,values)).map(f=>f.key)
const roundTrip=(p:Project)=>parseProject(serializeProject(p))

describe('component decision gates',()=>{
  it('starts every gate unanswered, shows only the gate questions and requires an answer',()=>{
    const p=newProject()
    expect(Object.keys(decisionGates).map(key=>p.decisions[key])).toEqual(Array(8).fill(''))
    expect(keys(p,'network')).toEqual(['firewallProvider','siteToSiteVpn','pointToSiteVpn','expressRoute','torProvider','oobModel'])
    expect(keys(p,'operations')).toEqual(['backupInScope','monitoringInScope'])
    expect(decisionFindings(p).filter(f=>f.code==='COMPONENT_DECISION').map(f=>f.fieldKey)).toEqual(Object.keys(decisionGates))
    expect(validate(p).some(f=>f.code==='COMPONENT_DECISION'&&f.fieldKey==='firewallProvider'&&f.severity==='error')).toBe(true)
  })

  const gates:[string,string,string,string,string[]][]=[
    ['firewallProvider','tierpoint-fortigate','none','fwModel',['firewallDevices','firewallInterfaces','firewallGateways']],
    ['siteToSiteVpn','yes','no','vpnOnPremPublicIp',[]],
    ['pointToSiteVpn','yes','no','p2sAddressPool',[]],
    ['expressRoute','yes','no','erProvider',[]],
    ['torProvider','dell-powerswitch','none','torModel',['torSwitches']],
    ['oobModel','opengear','none','lighthouseAddress',['oobDevices','consolePorts']],
    ['backupInScope','yes','no','backupProductName',[]],
    ['monitoringInScope','yes','no','monitoringServiceOwner',[]],
  ]
  for(const [gate,usedValue,unusedValue,detail,gated] of gates)it(`${gate}: used reveals, not used hides, answers are retained and excluded from infrastructure.yml`,()=>{
    const p=demoProject(1),section=decisionGates[gate as keyof typeof decisionGates].section,marker=`EXAMPLE-${gate}-detail`
    expect(keys(p,section)).not.toContain(detail)
    p.decisions[gate]=usedValue
    expect(keys(p,section)).toContain(detail)
    for(const key of gated)expect(collectionApplies(collection(key),p),key).toBe(true)
    p.decisions[detail]=marker
    const records=gated.map(key=>add(p,key,{name:`example-${key}`,managementIp:'192.0.2.50'}))
    const used=roundTrip(p);expect(used).toEqual(p)
    const usedYaml=environmentFiles(p)['infrastructure.yml']
    expect(usedYaml).toContain(marker)
    if(gated.includes('torSwitches')||gated.includes('firewallDevices')||gated.includes('oobDevices'))expect(usedYaml).toContain('example-')

    p.decisions[gate]=unusedValue
    expect(keys(p,section)).not.toContain(detail)
    for(const key of gated)expect(collectionApplies(collection(key),p),key).toBe(false)
    const reopened=roundTrip(p)
    expect(reopened.decisions[detail]).toBe(marker)
    for(const [i,key] of gated.entries())expect(reopened.design[key][0]).toEqual(records[i])
    const files=environmentFiles(p),infra=load(files['infrastructure.yml']) as {decisions:Record<string,{answer:string;used:boolean}>}
    expect(files['infrastructure.yml']).not.toContain(marker)
    for(const key of gated)expect(files['infrastructure.yml']).not.toContain(`example-${key}`)
    const component=decisionGates[gate as keyof typeof decisionGates].component
    expect(infra.decisions[component]).toEqual({answer:unusedValue,used:false})
    const devices=load(files['environment/network-devices.yml']) as Record<string,unknown>
    for(const key of gated)expect(devices??{}).not.toHaveProperty(key)
    expect(validate(p).some(f=>gated.some(key=>p.design[key].some(r=>r.id===f.recordId)))).toBe(false)
  })

  it('hides port-map fields on retained adapter and host records until the ToR or OOB component is used',()=>{
    const p=demoProject(1),host=p.design.hosts[0]
    const nic=add(p,'adapters',{name:'nic-a',host:host.id,mac:'00:11:22:33:44:55',torPort:'ethernet1/1/5'})
    host.values.bmcOobPort='og-port-7'
    expect(visible(p,'adapters',nic.values)).not.toContain('torPort')
    expect(visible(p,'hosts',host.values)).not.toContain('bmcOobPort')
    expect(environmentFiles(p)['environment/networking.yml']).not.toContain('ethernet1/1/5')
    expect(environmentFiles(p)['environment/hardware.yml']).not.toContain('og-port-7')
    expect(last(roundTrip(p).design.adapters).values.torPort).toBe('ethernet1/1/5')
    p.decisions.torProvider='customer';p.decisions.oobModel='oob-switch'
    expect(visible(p,'adapters',nic.values)).toContain('torSwitch')
    expect(visible(p,'hosts',host.values)).toEqual(expect.arrayContaining(['bmcOobDevice','bmcOobPort']))
    expect(environmentFiles(p)['environment/networking.yml']).toContain('ethernet1/1/5')
  })

  it('declined backup and monitoring hide operations questions without raising findings on retained answers',()=>{
    const p=demoProject(1),plan=add(p,'operations',{name:'ops',scope:'cluster',backup:'EXAMPLE backup text',monitoring:'EXAMPLE alerts'})
    add(p,'operationsTargets',{name:'target',plan:plan.id,resource:p.design.clusters[0].id,backup:true,monitoring:true})
    expect(validate(p).some(f=>f.recordId===plan.id&&['backupOwner','monitoringTool'].includes(String(f.fieldKey)))).toBe(true)
    p.decisions.backupInScope='no';p.decisions.monitoringInScope='no'
    expect(visible(p,'operations',plan.values)).not.toEqual(expect.arrayContaining(['backup']))
    expect(visible(p,'operations',plan.values)).not.toContain('monitoringTool')
    expect(validate(p).some(f=>f.recordId===plan.id&&['backupOwner','monitoringTool'].includes(String(f.fieldKey)))).toBe(false)
    expect(environmentFiles(p)['environment/operations.yml']).not.toContain('EXAMPLE backup text')
    expect(last(roundTrip(p).design.operations).values.backup).toBe('EXAMPLE backup text')
  })

  it('shows ToR DCB questions only when S2D storage traffic is switched',()=>{
    const p=demoProject(1);p.decisions.torProvider='dell-powerswitch'
    const dcb=['torStorageVlans','torRdma','torSmbPriority','torClusterPriority','torEtsSmbPercent','torEtsClusterPercent']
    expect(keys(p,'network')).not.toEqual(expect.arrayContaining(['torSmbPriority']))
    const s2d=add(p,'storageSystems',{name:'s2d',cluster:p.design.clusters[0].id,kind:'s2d',storageConnectivity:'switchless'})
    expect(keys(p,'network').filter(k=>dcb.includes(k))).toEqual([])
    s2d.values.storageConnectivity='switched'
    expect(keys(p,'network').filter(k=>dcb.includes(k))).toEqual(dcb)
  })
})

describe('storage connectivity branches',()=>{
  it('reveals Fibre Channel or iSCSI questions from the reused storage kind and S2D connectivity only for S2D',()=>{
    const p=demoProject(1),values=(kind:string,extra:Answers={})=>({...newRecord(collection('storageSystems')).values,kind,...extra})
    const fc=visible(p,'storageSystems',values('fc')),iscsi=visible(p,'storageSystems',values('iscsi')),s2d=visible(p,'storageSystems',values('s2d')),switchless=visible(p,'storageSystems',values('s2d',{storageConnectivity:'switchless'}))
    expect(fc).toEqual(expect.arrayContaining(['fcFabricA','fcFabricB','fcZoning','fcTargetWwpns','mpio']))
    expect(fc).not.toEqual(expect.arrayContaining(['iscsiNetworkA']))
    expect(fc).not.toContain('storageConnectivity')
    expect(iscsi).toEqual(expect.arrayContaining(['iscsiNetworkA','iscsiNetworkB','iscsiVlanA','iscsiVlanB','iscsiPortals','iscsiTargetIqn','mpio']))
    expect(iscsi).not.toContain('fcFabricA')
    expect(s2d).toContain('storageConnectivity');expect(s2d).not.toContain('switchlessLinks');expect(switchless).toContain('switchlessLinks')
    expect(visible(p,'storageSystems',values('fc',{storageConnectivity:'switchless'}))).not.toContain('switchlessLinks')
  })

  it('exports only the selected SAN protocol with its fabrics or paths and initiators',()=>{
    const p=demoProject(1),system=p.design.storageSystems[0],host=p.design.hosts[0]
    Object.assign(system.values,{fcFabricA:'EXAMPLE-fabric-a',fcFabricB:'EXAMPLE-fabric-b',fcZoning:'single-initiator',iscsiPortals:'EXAMPLE-portal'})
    add(p,'storageInterfaces',{name:'hba-a',host:host.id,protocol:'fc',initiator:'20:00:00:00:00:00:00:01',pathSide:'a',port:'slot1-port1'})
    type Infra={compute:{clusters:{hyperv:{storage_systems:Record<string,unknown>[]}[]};cluster_nodes:{node_hostname:string;fc_hba?:unknown[]}[]}}
    let infra=load(environmentFiles(p)['infrastructure.yml']) as Infra
    expect(infra.compute.clusters.hyperv[0].storage_systems[0]).toMatchObject({kind:'fc',fibre_channel:{fabric_a:'EXAMPLE-fabric-a',fabric_b:'EXAMPLE-fabric-b',zoning:'single-initiator',initiators:[{initiator:'20:00:00:00:00:00:00:01',path:'a'}]}})
    expect(infra.compute.clusters.hyperv[0].storage_systems[0]).not.toHaveProperty('iscsi')
    expect(infra.compute.cluster_nodes[0].fc_hba).toEqual([{port:'slot1-port1',wwpn:'20:00:00:00:00:00:00:01',path:'a'}])
    system.values.kind='iscsi'
    infra=load(environmentFiles(p)['infrastructure.yml']) as Infra
    expect(infra.compute.clusters.hyperv[0].storage_systems[0]).toMatchObject({kind:'iscsi',iscsi:{target_portals:'EXAMPLE-portal'}})
    expect(environmentFiles(p)['infrastructure.yml']).not.toContain('EXAMPLE-fabric-a')
  })

  it('applies the Windows Server switchless full-mesh rule',()=>{
    const p=demoProject(1),cluster=p.design.clusters[0].id
    const storage=add(p,'networks',{name:'storage',purpose:'storage',routingScope:'storage',cidr:'198.51.100.0/24'})
    const s2d=add(p,'storageSystems',{name:'Example S2D',cluster,kind:'s2d',storageConnectivity:'switchless',switchlessLinks:'2'})
    add(p,'hosts',{name:'example-hv03',cluster,managementIp:'192.0.2.13'})
    const all=()=>decisionFindings(p).filter(f=>f.recordId===s2d.id).map(f=>f.code)
    expect(all()).toContain('S2D_SWITCHLESS_CABLE_MAP')
    const codes=()=>all().filter(code=>code!=='S2D_SWITCHLESS_CABLE_MAP')
    expect(codes()).toEqual([])
    for(const host of p.design.hosts)for(let i=0;i<2;i++)add(p,'adapters',{name:`smb-${host.values.name}-${i}`,host:host.id,network:storage.id})
    expect(codes()).toEqual(['S2D_SWITCHLESS_PORTS','S2D_SWITCHLESS_PORTS','S2D_SWITCHLESS_PORTS'])
    for(const host of p.design.hosts)for(let i=2;i<4;i++)add(p,'adapters',{name:`smb-${host.values.name}-${i}`,host:host.id,network:storage.id})
    expect(codes()).toEqual([])
    for(let i=4;i<=5;i++)add(p,'hosts',{name:`example-hv0${i}`,cluster})
    expect(codes()).toContain('S2D_SWITCHLESS_SCALE')
    s2d.values.storageConnectivity='switched'
    expect(codes()).toEqual([])
  })
})

describe('cheap gate fixes and schema 31',()=>{
  it('hides witness placement and prerequisite notes when a cluster has no witness',()=>{
    const {project}=quorumFixture('cloud'),cluster=project.design.clusters[0]
    expect(visible(project,'clusters',cluster.values)).toEqual(expect.arrayContaining(['witnessRef','witnessPlacement','witnessPrerequisites','witnessAcceptance']))
    cluster.values.witness='none'
    const fields=visible(project,'clusters',cluster.values)
    expect(fields).not.toEqual(expect.arrayContaining(['witnessRef']))
    expect(fields).not.toContain('witnessPlacement');expect(fields).not.toContain('witnessPrerequisites');expect(fields).toContain('witnessAcceptance')
    cluster.values.witnessPlacement='';cluster.values.witnessPrerequisites=''
    expect(quorumConfiguration(project).findings.map(f=>f.code)).not.toContain('quorum-review')
    cluster.values.witnessAcceptance=''
    expect(quorumConfiguration(project).findings.map(f=>f.code)).toContain('quorum-review')
  })

  it('migrates schema 30 with unanswered gates and no inferred devices, and rejects mixed schemas',()=>{
    const p=demoProject(1),old=JSON.parse(serializeProject(p))
    removeNetworkDecisionsV31(old);old.schemaVersion=30
    const next=parseProject(JSON.stringify(old))
    expect(next.schemaVersion).toBe(32)
    expect(next.decisions).toEqual(newProject().decisions)
    for(const key of ['firewallDevices','firewallInterfaces','firewallGateways','torSwitches','oobDevices','consolePorts'])expect(next.design[key]).toEqual([])
    expect(next.design.storageSystems[0].values).toMatchObject({kind:'fc',storageConnectivity:'',fcFabricA:''})
    expect(next.design.hosts[0].values.bmcOobPort).toBe('')
    expect(()=>parseProject(JSON.stringify({...old,decisions:{}}))).toThrow('Schema 30')
    old.design.hosts[0].values.bmcOobPort='x'
    expect(()=>parseProject(JSON.stringify(old))).toThrow('Schema 30')
  })

  it('accepts only runtime references for decision secrets and withholds them when sharing',()=>{
    const p=demoProject(1);p.decisions.oobModel='opengear'
    p.decisions.lighthouseEnrollmentAuthRef='plain-token-value'
    expect(()=>serializeProject(p)).toThrow('keyvault')
    p.decisions.lighthouseEnrollmentAuthRef='keyvault://example-vault/lighthouse-enrollment'
    p.decisions.vpnOnPremPublicIp='203.0.113.10'
    expect(()=>serializeProject(p)).not.toThrow()
    const shared=sanitizeProject(p)
    expect(serializeProject(shared)).not.toContain('example-vault')
    expect(serializeProject(shared)).not.toContain('203.0.113.10')
    expect(shared.decisions.oobModel).toBe('opengear')
  })
})
