import {describe,it,expect} from 'vitest'
import {load} from 'js-yaml'
import {newRecord,collections,type Answers} from './catalog'
import type {Project} from './project'
import {demoProject} from './scenarios'
import {billOfMaterialsCsv,environmentFiles} from './exports'
import {INFRASTRUCTURE_EXTENSIONS,INFRASTRUCTURE_REGISTRY_KEYS,infrastructureYaml,masterInfrastructure} from './infrastructureYaml'
import {decisionFindings} from './componentDecisions'
import {consoleServerPlatforms,firewallPlatforms,serverPlatforms,switchPlatforms} from './vendorPlatforms'

const add=(p:Project,key:string,values:Answers)=>{const row=newRecord(collections.find(c=>c.key===key)!);Object.assign(row.values,values);p.design[key].push(row);return row}

function fullDesign(){
  const p=demoProject(1),host=p.design.hosts[0],cluster=p.design.clusters[0]
  Object.assign(p.decisions,{
    firewallProvider:'provider',firewallPlatform:'fortinet',firewallOwner:'Example provider support',fwModel:'FortiGate-90G',fwHaMode:'active-passive',fwFirmware:'7.4.4',fwVirtualContexts:'root; customer',
    siteToSiteVpn:'yes',vpnOnPremPublicIp:'203.0.113.10',vpnGatewaySku:'VpnGw2AZ',vpnActiveActive:'yes',vpnGatewaySubnet:'10.10.0.0/27',vpnIpsecPolicy:'custom',vpnCustomPolicy:'EXAMPLE policy',vpnSharedKeyRef:'keyvault://example/psk',vpnBgp:'yes',vpnOnPremAsn:65010,vpnAzureAsn:65515,vpnOnPremBgpPeerIp:'169.254.21.1',
    pointToSiteVpn:'yes',p2sAddressPool:'172.16.200.0/24',p2sTunnelType:'openvpn',p2sAuthentication:'entra',p2sEntraTenant:'https://login.example.test/tenant',
    expressRoute:'yes',erProvider:'Example carrier',erCircuitName:'er-example',erPeeringLocation:'Example metro',erBandwidthMbps:1000,erSku:'standard',erPrimarySubnet:'192.168.100.0/30',erSecondarySubnet:'192.168.100.4/30',erVlanId:200,erPeerAsn:65020,
    torProvider:'provider',torPlatform:'dell-os10',torModel:'S5248F-ON',torOsVersion:'10.5.6',torPairMode:'mlag',torPairDomain:'1',torPeerLinkPorts:'ethernet1/1/49-1/1/52',torMtu:9216,torStorageVlans:'711,712',torRdma:'roce',torSmbPriority:'3',torClusterPriority:'7',torEtsSmbPercent:50,torEtsClusterPercent:1,
    oobSwitch:'yes',oobSwitchPlatform:'cisco-iosxe',oobSwitchOsVersion:'17.9',oobVlan:2064,
    consoleServer:'yes',consoleServerPlatform:'opengear',consoleManagement:'existing',consoleManagementProduct:'Opengear Lighthouse',consoleManagementAddress:'lighthouse.example.test',consoleEnrollmentRef:'keyvault://example/lh-token',
    backupInScope:'yes',backupProductName:'Example backup 1.0',backupLevel:'host',monitoringInScope:'no',
  })
  add(p,'storageSystems',{name:'Example S2D',cluster:cluster.id,kind:'s2d',storageConnectivity:'switched'})
  const fwA=add(p,'firewallDevices',{name:'example-fw-a',role:'primary',managementIp:'192.0.2.8',wanIp:'203.0.113.10',haPriority:200})
  add(p,'firewallDevices',{name:'example-fw-b',role:'secondary',managementIp:'192.0.2.9'})
  const torA=add(p,'torSwitches',{name:'example-tor-a',role:'primary',managementIp:'192.0.2.2'})
  add(p,'firewallInterfaces',{name:'port3',firewall:fwA.id,purpose:'tor-uplink',torSwitch:torA.id,torPort:'ethernet1/1/54'})
  add(p,'firewallGateways',{name:'mgmt',network:p.design.networks[0].id,gatewayIp:'192.0.2.1',virtualContext:'customer',dhcp:'server',dhcpStart:'192.0.2.100',dhcpEnd:'192.0.2.150'})
  add(p,'adapters',{name:'nic-a',host:host.id,mac:'00:11:22:33:44:55',torSwitch:torA.id,torPort:'ethernet1/1/5'})
  const oob=add(p,'oobDevices',{name:'example-oob-1',managementIp:'192.0.2.4',model:'C9200L-48T'})
  const og=add(p,'consoleServers',{name:'example-og-1',managementIp:'192.0.2.3',model:'OM1208-8E',serialPortCount:8,cellularFailover:'cellular',cellularApn:'example.apn'})
  add(p,'consolePorts',{name:'tor-a console',consoleServer:og.id,portNumber:1,targetKind:'tor',targetTor:torA.id,baud:'115200'})
  Object.assign(host.values,{hardwarePlatform:'hpe',bmcAddress:'192.0.2.64',bmcOobDevice:oob.id,bmcOobPort:'port-7'})
  return p
}

describe('master infrastructure.yml',()=>{
  it('uses the Azure Local Toolkit master shape with a decisions section and linked port maps',()=>{
    const p=fullDesign(),text=environmentFiles(p)['infrastructure.yml'],infra=load(text) as any
    expect(Object.keys(infra)).toEqual(['_metadata','decisions','networking','compute','operations'])
    expect(infra._metadata).toMatchObject({schema_version:'4.0.0',generator:'hyperv-configurator',project_schema_version:33,deployment_state:'not_executed_by_configurator'})
    expect(Object.keys(infra.decisions)).toEqual(['management_plane','firewall','site_to_site_vpn','point_to_site_vpn','expressroute','tor_switches','out_of_band_management','console_server','storage','sdn','cluster_witness','backup','monitoring'])
    expect(infra.decisions.firewall).toEqual({answer:'provider',used:true})
    expect(infra.decisions.monitoring).toEqual({answer:'no',used:false})
    const devices=infra.networking.onprem.network_devices
    for(const device of devices)for(const key of ['device_type','device_role','device_hostname','device_management_ip'])expect(device,device.device_hostname).toHaveProperty(key)
    expect(devices.map((d:any)=>[d.device_type,d.device_function,d.device_vendor,d.device_hostname])).toEqual([['firewall','perimeter_firewall','Fortinet','example-fw-a'],['firewall','perimeter_firewall','Fortinet','example-fw-b'],['switch','top_of_rack','Dell','example-tor-a'],['switch','out_of_band','Cisco','example-oob-1'],['console_server','console_access','Opengear','example-og-1']])
    expect(devices[0]).toMatchObject({device_platform:'fortinet',device_ownership:'provider',device_os:'FortiOS',device_owner:'Example provider support',device_model:'FortiGate-90G',device_virtual_contexts:'root; customer',device_ha_enabled:true,device_ha_mode:'active-passive',device_ha_priority:200,device_gateway_ips:['192.0.2.1'],device_port_config:[{port:'port3',tor_switch:'example-tor-a',tor_port:'ethernet1/1/54'}],device_dhcp_scopes:[{dhcp:'server',scope_start:'192.0.2.100',virtual_context:'customer'}]})
    expect(devices[2]).toMatchObject({device_platform:'dell-os10',device_os:'SmartFabric OS10',device_pairing:'mlag',device_ha_mode:'active-active',device_pair_domain:'1',device_mtu:9216,device_dcb:{storage_vlans:'711,712',rdma_type:'roce',pfc_priority_smb:3,priority_cluster_heartbeat:7,ets_percent_smb:50,ets_percent_cluster_heartbeat:1},
      device_port_config:[{port:'ethernet1/1/5',connected_adapter:'nic-a',mac:'00:11:22:33:44:55'},{port:'ethernet1/1/54',connected_firewall:'example-fw-a',connected_firewall_port:'port3'}]})
    expect(devices[3]).toMatchObject({device_os:'IOS XE',device_firmware_version:'17.9',device_model:'C9200L-48T',device_management_vlan:2064,device_port_config:[{port:'port-7',bmc_address:'192.0.2.64'}]})
    expect(devices[4]).toMatchObject({device_serial_ports:8,device_management_vlan:2064,device_cellular_failover:{mode:'cellular',apn:'example.apn'},device_central_management:{product:'Opengear Lighthouse',instance:'existing',address:'lighthouse.example.test',enrollment_token_ref:'keyvault://example/lh-token'},device_console_ports:[{port_number:1,target_type:'tor',target:'example-tor-a',baud_rate:'115200'}]})
    expect(infra.networking.onprem.firewall).toEqual({ownership:'provider',platform:'fortinet',vendor:'Fortinet',os:'FortiOS',os_version:'7.4.4',model:'FortiGate-90G',owner:'Example provider support'})
    expect(infra.networking.onprem.vlans).toMatchObject({example_management:{vlan_id:100,cidr:'192.0.2.0/24'},vlan_oob_id:2064})
    const gateway=infra.networking.hybrid.vpn.vpn_gateways[0]
    expect(gateway).toMatchObject({gateway_sku:'VpnGw2AZ',active_active:true,site_to_site:{custom_policy:'EXAMPLE policy',shared_key_ref:'keyvault://example/psk',bgp:{enabled:true,on_prem_asn:65010,azure_asn:65515}},point_to_site:{client_address_pool:'172.16.200.0/24',authentication:'entra',entra_tenant:'https://login.example.test/tenant'}})
    expect(gateway.point_to_site).not.toHaveProperty('root_certificate')
    expect(infra.networking.express_route).toMatchObject({provider:'Example carrier',private_peering:{primary_subnet:'192.168.100.0/30',vlan_id:200,peer_asn:65020}})
    expect(infra.compute.cluster_nodes[0]).toMatchObject({node_hostname:'example-hv01',node_management_ip:'192.0.2.11',node_bmc_ip:'192.0.2.64',node_bmc_type:'iLO',node_hardware_platform:'hpe',node_vendor:'HPE',node_bmc_oob:{device:'example-oob-1',port:'port-7'}})
    expect(infra.compute.cluster_nodes[0]).not.toHaveProperty('node_idrac_ip')
    expect(infra.compute.clusters.hyperv[0]).toMatchObject({cluster_name:'example-hv',cluster_node_count:2})
    expect(infra.operations).toEqual({bcdr:{backup:{product:'Example backup 1.0',level:'host'}}})
    expect(text.startsWith('# infrastructure.yml')).toBe(true)
    expect(environmentFiles(p)['infrastructure.yml']).toBe(text)
  })

  it('writes the vendor and OS of every listed platform and the typed vendor for other',()=>{
    const p=fullDesign()
    const device=(fn:string)=>(masterInfrastructure(p) as any).networking.onprem.network_devices.find((d:any)=>d.device_function===fn)
    for(const [list,gate,key,vendorKey,fn] of [[firewallPlatforms,'firewallProvider','firewallPlatform','firewallVendor','perimeter_firewall'],[switchPlatforms,'torProvider','torPlatform','torVendor','top_of_rack'],[switchPlatforms,'oobSwitch','oobSwitchPlatform','oobSwitchVendor','out_of_band'],[consoleServerPlatforms,'consoleServer','consoleServerPlatform','consoleServerVendor','console_access']] as const){
      expect(p.decisions[gate],gate).not.toBe('')
      for(const [platform,info] of Object.entries(list)){
        p.decisions[key]=platform;p.decisions[vendorKey]=platform==='other'?'Example vendor':''
        expect(device(fn)?.device_vendor,`${key}=${platform}`).toBe(platform==='other'?'Example vendor':info.vendor)
        if(info.os)expect(device(fn)?.device_os,`${key}=${platform}`).toBe(info.os)
      }
    }
    for(const [platform,info] of Object.entries(serverPlatforms)){
      p.design.hosts[0].values.hardwarePlatform=platform;p.design.hosts[0].values.vendor=platform==='other'?'Example servers':''
      const node=(masterInfrastructure(p) as any).compute.cluster_nodes[0]
      expect(node.node_vendor,platform).toBe(platform==='other'?'Example servers':info.vendor)
      if(info.bmc)expect(node.node_bmc_type,platform).toBe(info.bmc)
    }
  })

  it('leaves every inactive component and hidden follow-up out while keeping the decision record',()=>{
    const p=fullDesign()
    Object.assign(p.decisions,{firewallProvider:'customer',firewallPlatform:'palo-alto',firewallOwner:'Example owner',fwModel:'PA-440',fwFirmware:'11.1',siteToSiteVpn:'no',pointToSiteVpn:'no',expressRoute:'no',torProvider:'none',consoleServer:'no',backupInScope:'no'})
    const infra=masterInfrastructure(p) as any,text=JSON.stringify(infra)
    expect(infra.networking.onprem.firewall).toEqual({ownership:'customer',platform:'palo-alto',vendor:'Palo Alto Networks',os:'PAN-OS',os_version:'11.1',model:'PA-440',owner:'Example owner'})
    expect(infra.networking.onprem.network_devices.map((d:any)=>[d.device_type,d.device_vendor,d.device_hostname])).toEqual([['firewall','Palo Alto Networks','example-fw-a'],['firewall','Palo Alto Networks','example-fw-b'],['switch','Cisco','example-oob-1']])
    expect(infra.networking.onprem.network_devices[0].device_port_config).toEqual([{port:'port3',purpose:'tor-uplink'}])
    expect(infra.networking).not.toHaveProperty('hybrid');expect(infra.networking).not.toHaveProperty('express_route');expect(infra).not.toHaveProperty('operations')
    for(const hidden of ['FortiGate-90G','example-tor-a','S5248F-ON','VpnGw2AZ','Example carrier','lighthouse.example.test','example-og-1','Example backup'])expect(text).not.toContain(hidden)
    expect(infra.decisions.tor_switches).toEqual({answer:'none',used:false})
    expect(infra.decisions.console_server).toEqual({answer:'no',used:false})
    expect(infra.compute.cluster_nodes[0].node_bmc_oob).toEqual({device:'example-oob-1',port:'port-7'})
    p.decisions.oobSwitch='no'
    const noOob=masterInfrastructure(p) as any
    expect(noOob.networking.onprem.vlans).not.toHaveProperty('vlan_oob_id')
    expect(noOob.compute.cluster_nodes[0]).not.toHaveProperty('node_bmc_oob')
  })

  it('exports a decision key missing from the project as unanswered instead of throwing',()=>{
    const p=fullDesign()
    delete p.decisions.firewallProvider;delete p.decisions.monitoringInScope
    expect(()=>masterInfrastructure(p)).not.toThrow()
    const infra=masterInfrastructure(p) as any
    expect(infra.decisions.firewall).toEqual({answer:null,used:false})
    expect(infra.decisions.monitoring).toEqual({answer:null,used:false})
    expect(infra.networking.onprem.network_devices.some((d:any)=>d.device_type==='firewall')).toBe(false)
    expect(decisionFindings(p).filter(f=>f.code==='COMPONENT_DECISION').map(f=>f.fieldKey)).toEqual(expect.arrayContaining(['firewallProvider','monitoringInScope']))
    // The strict project parser used by package exports rejects a missing key, so dump the file writer directly.
    const yaml=load(infrastructureYaml(p)) as any
    expect(yaml.decisions.firewall).toEqual({answer:null,used:false})
  })

  it('emits only Toolkit registry keys or documented extensions',()=>{
    const allowed=[...INFRASTRUCTURE_REGISTRY_KEYS,...Object.keys(INFRASTRUCTURE_EXTENSIONS)].map(entry=>new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\\*/g,'[^.\\[]+')}(?:$|[.\\[])`))
    const uncovered=(doc:unknown)=>{
      const leaves=new Set<string>()
      const walk=(value:unknown,path:string)=>{
        if(Array.isArray(value)){if(!value.length)leaves.add(path);for(const item of value)walk(item,`${path}[]`)}
        else if(value&&typeof value==='object'){const keys=Object.keys(value);if(!keys.length)leaves.add(path);for(const key of keys)walk((value as Record<string,unknown>)[key],path?`${path}.${key}`:key)}
        else leaves.add(path)
      }
      walk(doc,'')
      return [...leaves].filter(path=>!allowed.some(pattern=>pattern.test(path)))
    }
    const infra=masterInfrastructure(fullDesign()) as any
    expect(uncovered(infra)).toEqual([])
    // Planted drift: an undocumented key must be reported.
    infra.networking.onprem.unexpected_key='drift'
    expect(uncovered(infra)).toEqual(['networking.onprem.unexpected_key'])
  })

  it('lists network devices in the bill of materials only when their component is used',()=>{
    const p=fullDesign()
    for(const name of ['example-fw-a','example-tor-a','example-oob-1','example-og-1'])expect(billOfMaterialsCsv(p)).toContain(name)
    expect(billOfMaterialsCsv(p)).toContain('Fortinet FortiGate-90G')
    Object.assign(p.decisions,{firewallProvider:'none',torProvider:'none',consoleServer:'no'})
    const csv=billOfMaterialsCsv(p)
    for(const name of ['example-fw-a','example-tor-a','example-og-1'])expect(csv).not.toContain(name)
    expect(csv).toContain('example-oob-1')
  })
})
