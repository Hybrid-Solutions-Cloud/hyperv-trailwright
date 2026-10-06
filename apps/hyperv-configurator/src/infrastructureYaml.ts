import {dump} from 'js-yaml'
import type {Answer,DesignRecord} from './catalog'
import type {Project} from './project'
import metadata from '../package.json'
import {activeStorageLinks,allActiveDecisionFields,componentUsed,decisionRecord,switchedStorage} from './componentDecisions'

/*
 * Master infrastructure.yml generator. DATA ONLY: it describes the design for existing automation to consume and
 * never produces scripts or templates.
 *
 * Shape: Azure Local Toolkit infrastructure.schema.json v4.0.0 and master-registry.yaml v4.0.0
 * (azl-toolkit/configs/variables/assets, pinned in apps/azurelocal-configurator/src/contracts/toolkit).
 * INFRASTRUCTURE_REGISTRY_KEYS lists the registry keys used as-is; INFRASTRUCTURE_EXTENSIONS lists every key the
 * registry does not define. infrastructureYaml.test.ts walks the generated file and fails on any key that is in
 * neither the registry nor the extension list, so the two lists cannot drift from the generator.
 *
 * Conflicts in the toolkit contract:
 *   - infrastructure.schema.json declares networking.onprem.network_devices as an object; master-registry.yaml
 *     defines an item list. The registry is canonical, so network_devices is emitted as an array.
 *   - networking.hybrid allows only `vpn` (additionalProperties: false), so ExpressRoute is emitted at
 *     networking.express_route, where networking accepts additional keys.
 *   - The registry scopes network_devices to wsfc_s2d / wsfc_san infrastructure types, which matches Hyper-V.
 *   - The registry names VLANs by fixed role (vlan_management_compute_*); the Configurator emits one entry per
 *     designed network under networking.onprem.vlans.<network> next to the registry vlan_oob_* keys.
 *   - The registry defines compute.cluster_nodes[].fc_hba[] in compute_cluster_nodes_fc_hba.fields.
 *
 * Only components in use appear outside `decisions`. Hidden answers stay in project.json.
 */

/** Registry keys emitted as-is. Paths use `[]` for array items. */
export const INFRASTRUCTURE_REGISTRY_KEYS=[
  '_metadata.version','_metadata.schema_version','_metadata.last_updated',
  'networking.onprem.vlans','networking.onprem.vlans.vlan_oob_id','networking.onprem.vlans.vlan_oob_name','networking.onprem.vlans.vlan_oob_cidr','networking.onprem.vlans.vlan_oob_gateway',
  ...['device_type','device_role','device_hostname','device_management_ip','device_management_vlan','device_vendor','device_model','device_serial_number','device_firmware_version',
    'device_ha_enabled','device_ha_mode','device_ha_priority','device_serial_ports','device_wan_ip','device_gateway_ips','device_port_config','device_port_config[].port','device_rack_position','device_notes'].map(k=>`networking.onprem.network_devices[].${k}`),
  'networking.hybrid.vpn.vpn_gateways',
  ...['node_hostname','node_fqdn','node_management_ip','node_idrac_ip','node_serial_number','node_model','fc_hba','fc_hba[].port','fc_hba[].wwpn'].map(k=>`compute.cluster_nodes[].${k}`),
  'compute.clusters','operations.bcdr','operations.monitoring',
] as const

/**
 * Hyper-V Configurator extension keys (no key exists in registry v4.0.0). A path allows every key below it.
 * `*` matches one key whose value is an object or list (a designed network name).
 */
export const INFRASTRUCTURE_EXTENSIONS:Record<string,string>={
  'decisions':'every component gate, its answer and whether it is used',
  '_metadata.environment_name':'design name',
  '_metadata.generator':'generator name','_metadata.generator_version':'generator version','_metadata.project_id':'project ID',
  '_metadata.project_schema_version':'project schema version','_metadata.deployment_state':'always not_executed_by_configurator',
  'networking.onprem.vlans.*':'one entry per designed network: vlan_id, purpose, cidr, gateway, dns, mtu, routing_scope',
  'networking.onprem.customer_firewall':'customer-owned firewall vendor, gateway IPs and owner',
  'networking.onprem.network_devices[].device_function':'perimeter_firewall | top_of_rack | out_of_band',
  'networking.onprem.network_devices[].device_wan_addresses':'FortiGate WAN addresses and ISP handoff',
  'networking.onprem.network_devices[].device_vdoms':'FortiGate VDOMs',
  'networking.onprem.network_devices[].device_dhcp_scopes':'FortiGate VLAN gateways with DHCP server or relay',
  'networking.onprem.network_devices[].device_owner':'customer switch owner',
  'networking.onprem.network_devices[].device_os':'ToR operating system',
  'networking.onprem.network_devices[].device_pairing':'ToR VLT / MLAG / single',
  'networking.onprem.network_devices[].device_vlt_domain':'ToR VLT or MLAG domain',
  'networking.onprem.network_devices[].device_peer_link_ports':'ToR peer-link ports',
  'networking.onprem.network_devices[].device_uplinks':'ToR uplinks to core or firewall',
  'networking.onprem.network_devices[].device_uplink_ports':'ToR uplink ports',
  'networking.onprem.network_devices[].device_mtu':'ToR port MTU',
  'networking.onprem.network_devices[].device_dcb':'ToR DCB for switched S2D storage',
  'networking.onprem.network_devices[].device_uplink':'OOB device uplink',
  'networking.onprem.network_devices[].device_cellular_failover':'Opengear cellular failover',
  'networking.onprem.network_devices[].device_lighthouse':'Opengear Lighthouse enrollment',
  'networking.onprem.network_devices[].device_console_ports':'Opengear console port map',
  'networking.onprem.network_devices[].device_port_config[].purpose':'firewall interface purpose',
  'networking.onprem.network_devices[].device_port_config[].vlans':'VLANs carried by a firewall interface',
  'networking.onprem.network_devices[].device_port_config[].speed_gbps':'firewall interface speed',
  'networking.onprem.network_devices[].device_port_config[].tor_switch':'ToR switch a firewall port connects to',
  'networking.onprem.network_devices[].device_port_config[].tor_port':'ToR port a firewall port connects to',
  'networking.onprem.network_devices[].device_port_config[].connected_host':'host on a ToR or OOB port',
  'networking.onprem.network_devices[].device_port_config[].connected_adapter':'host adapter on a ToR port',
  'networking.onprem.network_devices[].device_port_config[].mac':'host adapter MAC on a ToR port',
  'networking.onprem.network_devices[].device_port_config[].connected_firewall':'firewall on a ToR port',
  'networking.onprem.network_devices[].device_port_config[].connected_firewall_port':'firewall port on a ToR port',
  'networking.onprem.network_devices[].device_port_config[].bmc_address':'host BMC address on an OOB port',
  'networking.hybrid.vpn.vpn_gateways[].gateway_sku':'Azure VPN gateway SKU (registry sku is a per-tenant example)',
  'networking.hybrid.vpn.vpn_gateways[].active_active':'active-active or active-standby',
  'networking.hybrid.vpn.vpn_gateways[].gateway_subnet':'GatewaySubnet prefix',
  'networking.hybrid.vpn.vpn_gateways[].site_to_site':'site-to-site VPN and BGP',
  'networking.hybrid.vpn.vpn_gateways[].point_to_site':'point-to-site VPN',
  'networking.express_route':'ExpressRoute circuit and private peering',
  'compute.clusters.hyperv':'Hyper-V clusters, witness, storage connectivity, SAN protocol and the switchless cable map',
  'compute.cluster_nodes[].node_cluster':'cluster the node belongs to',
  'compute.cluster_nodes[].node_bmc_oob':'OOB device and port for the BMC',
  'compute.cluster_nodes[].fc_hba[].fabric':'Fibre Channel fabric switch',
  'compute.cluster_nodes[].fc_hba[].path':'fabric side a or b',
  'operations.bcdr.backup':'backup product, level, server location, network and owner',
  'operations.monitoring.platform':'monitoring platform','operations.monitoring.log_analytics_workspace':'Log Analytics workspace',
  'operations.monitoring.owner':'monitoring service owner','operations.monitoring.network_device_logging':'syslog / SNMP destination',
}

type Tree=Answer|null|undefined|Tree[]|{[key:string]:Tree}
/** Drop unanswered values and empty groups so an unused component leaves no keys behind. */
function clean(value:Tree):Tree{
  if(Array.isArray(value)){const items=value.map(clean).filter(v=>v!==undefined);return items.length?items:undefined}
  if(value&&typeof value==='object'){const entries=Object.entries(value).map(([k,v])=>[k,clean(v)] as const).filter(([,v])=>v!==undefined);return entries.length?Object.fromEntries(entries):undefined}
  if(value===''||value===null||value===undefined)return undefined
  return value
}

export function masterInfrastructure(project:Project):Record<string,Tree>{
  const d=project.decisions,active=new Set(allActiveDecisionFields(project).map(f=>f.key))
  const s=(value:unknown)=>String(value??'').trim()
  const v=(key:string)=>active.has(key)?s(d[key]):''
  const n=(key:string)=>active.has(key)&&Number(d[key])>0?Number(d[key]):undefined
  const rows=(key:string):DesignRecord[]=>project.design[key]??[]
  const nameOf=(key:string,id:unknown)=>{const row=rows(key).find(r=>r.id===id);return row?s(row.values.name)||row.id:''}
  const yesNo=(value:string)=>value?value==='yes':undefined
  const fortigate=componentUsed(project,'fortigate'),tor=componentUsed(project,'tor'),oob=componentUsed(project,'oob'),opengear=componentUsed(project,'opengear')
  const s2s=componentUsed(project,'s2sVpn'),p2s=componentUsed(project,'p2sVpn'),er=componentUsed(project,'expressRoute')

  // A gate missing from project.decisions is unanswered: validation raises COMPONENT_DECISION and the export records answer null, not used.
  const decisions=decisionRecord(project) satisfies Record<string,Tree>

  const vlans:Record<string,Tree>={}
  for(const network of rows('networks')){
    let key=s(network.values.name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||network.id
    for(let i=2;key in vlans;i++)key=`${key.replace(/_\d+$/,'')}_${i}`
    vlans[key]={vlan_id:Number(network.values.vlan),purpose:s(network.values.purpose),cidr:s(network.values.cidr),gateway:s(network.values.gateway),dns:s(network.values.dns),mtu:Number(network.values.mtu)||undefined,routing_scope:s(network.values.routingScope)}
  }
  if(oob){
    const network=rows('networks').find(r=>r.id===d.oobNetwork)
    Object.assign(vlans,{vlan_oob_id:n('oobVlan')??(network?Number(network.values.vlan):undefined),vlan_oob_name:network?s(network.values.name):'',vlan_oob_cidr:network?s(network.values.cidr):'',vlan_oob_gateway:network?s(network.values.gateway):''})
  }

  const devices:Tree[]=[]
  if(fortigate){
    const gateways=rows('firewallGateways')
    for(const r of rows('firewallDevices'))devices.push({
      device_type:'firewall',device_function:'perimeter_firewall',device_role:s(r.values.role),device_hostname:s(r.values.name),device_management_ip:s(r.values.managementIp),
      device_vendor:'Fortinet',device_model:v('fwModel'),device_serial_number:s(r.values.serial),device_firmware_version:v('fwFirmware'),
      device_ha_enabled:v('fwHaMode')?v('fwHaMode')!=='standalone':undefined,device_ha_mode:v('fwHaMode')==='standalone'?'':v('fwHaMode'),device_ha_priority:Number(r.values.haPriority)||undefined,
      device_wan_ip:s(r.values.wanIp),device_wan_addresses:v('fwWanIps'),device_vdoms:v('fwVdoms'),device_rack_position:s(r.values.rack),device_notes:s(r.values.notes),
      device_gateway_ips:gateways.map(g=>s(g.values.gatewayIp)),
      device_dhcp_scopes:gateways.map(g=>({interface:s(g.values.name),network:nameOf('networks',g.values.network),gateway_ip:s(g.values.gatewayIp),vdom:s(g.values.vdom),dhcp:s(g.values.dhcp),
        scope_start:g.values.dhcp==='server'?s(g.values.dhcpStart):'',scope_end:g.values.dhcp==='server'?s(g.values.dhcpEnd):'',reservations:g.values.dhcp==='server'?s(g.values.dhcpReservations):'',relay_target:g.values.dhcp==='relay'?s(g.values.dhcpRelayTarget):''})),
      device_port_config:rows('firewallInterfaces').filter(i=>i.values.firewall===r.id).map(i=>({port:s(i.values.name),purpose:s(i.values.purpose),vlans:s(i.values.vlans),speed_gbps:Number(i.values.speedGbps)||undefined,
        tor_switch:tor&&i.values.purpose==='tor-uplink'?nameOf('torSwitches',i.values.torSwitch):'',tor_port:tor&&i.values.purpose==='tor-uplink'?s(i.values.torPort):''})),
    })
  }
  if(tor){
    const dcb=switchedStorage(project)?{storage_vlans:v('torStorageVlans'),rdma_type:v('torRdma'),pfc_priority_smb:v('torSmbPriority')?Number(v('torSmbPriority')):undefined,priority_cluster_heartbeat:v('torClusterPriority')?Number(v('torClusterPriority')):undefined,ets_percent_smb:n('torEtsSmbPercent'),ets_percent_cluster_heartbeat:n('torEtsClusterPercent')}:undefined
    for(const r of rows('torSwitches'))devices.push({
      device_type:'switch',device_function:'top_of_rack',device_role:s(r.values.role),device_hostname:s(r.values.name),device_management_ip:s(r.values.managementIp),
      device_vendor:d.torProvider==='dell-powerswitch'?'Dell':v('torVendor'),device_owner:v('torOwner'),device_model:v('torModel'),device_os:v('torOs'),device_firmware_version:v('torOsVersion'),device_serial_number:s(r.values.serial),
      device_pairing:v('torPairMode'),device_ha_enabled:v('torPairMode')?v('torPairMode')!=='single':undefined,device_ha_mode:['vlt','mlag'].includes(v('torPairMode'))?'active-active':'',
      device_vlt_domain:v('torVltDomain'),device_peer_link_ports:v('torPeerLinkPorts'),device_uplinks:v('torUplinks'),device_uplink_ports:s(r.values.uplinkPorts),device_mtu:n('torMtu'),device_rack_position:s(r.values.rack),device_dcb:dcb,
      device_port_config:[
        ...rows('adapters').filter(a=>a.values.torSwitch===r.id).map(a=>({port:s(a.values.torPort),connected_host:nameOf('hosts',a.values.host),connected_adapter:s(a.values.name),mac:s(a.values.mac)})),
        ...(fortigate?rows('firewallInterfaces').filter(i=>i.values.purpose==='tor-uplink'&&i.values.torSwitch===r.id).map(i=>({port:s(i.values.torPort),connected_firewall:nameOf('firewallDevices',i.values.firewall),connected_firewall_port:s(i.values.name)})):[]),
      ],
    })
  }
  if(oob){
    for(const r of rows('oobDevices'))devices.push({
      device_type:opengear?'console_server':'switch',device_function:'out_of_band',device_role:'standalone',device_hostname:s(r.values.name),device_management_ip:s(r.values.managementIp),
      device_management_vlan:Number(r.values.vlan)||n('oobVlan'),device_vendor:opengear?'OpenGear':s(r.values.vendor),device_model:s(r.values.model),device_serial_number:s(r.values.serial),device_rack_position:s(r.values.rack),device_uplink:s(r.values.uplink),
      device_serial_ports:opengear?Number(r.values.serialPortCount)||undefined:undefined,
      device_cellular_failover:opengear?{mode:s(r.values.cellularFailover),apn:r.values.cellularFailover==='cellular'?s(r.values.cellularApn):''}:undefined,
      device_lighthouse:opengear?{instance:v('lighthouseInstance'),address:v('lighthouseAddress'),port:n('lighthousePort'),enrollment_token_ref:v('lighthouseEnrollmentAuthRef'),enrollment_bundle:v('lighthouseEnrollmentBundle')}:undefined,
      device_console_ports:opengear?rows('consolePorts').filter(c=>c.values.consoleServer===r.id).map(c=>{
        const kind=s(c.values.targetKind),target=kind==='tor'?(tor?nameOf('torSwitches',c.values.targetTor):''):kind==='firewall'?(fortigate?nameOf('firewallDevices',c.values.targetFirewall):''):kind==='host'?nameOf('hosts',c.values.targetHost):s(c.values.targetOther)
        return {port_number:Number(c.values.portNumber)||undefined,label:s(c.values.name),target_type:kind,target,pinout:s(c.values.pinout),baud_rate:s(c.values.baud)}
      }):undefined,
      device_port_config:rows('hosts').filter(h=>h.values.bmcOobDevice===r.id).map(h=>({port:s(h.values.bmcOobPort),connected_host:s(h.values.name),bmc_address:s(h.values.bmcAddress)})),
    })
  }

  const vpnGateways=s2s||p2s?[{
    gateway_sku:v('vpnGatewaySku'),active_active:yesNo(v('vpnActiveActive')),gateway_subnet:v('vpnGatewaySubnet'),
    site_to_site:s2s?{on_prem_public_ip:v('vpnOnPremPublicIp'),on_prem_device:v('vpnOnPremDevice'),azure_address_spaces:v('vpnAzureAddressSpaces'),on_prem_address_spaces:v('vpnOnPremAddressSpaces'),ike_version:v('vpnIkeVersion'),ipsec_policy:v('vpnIpsecPolicy'),custom_policy:v('vpnCustomPolicy'),shared_key_ref:v('vpnSharedKeyRef'),
      bgp:{enabled:yesNo(v('vpnBgp')),on_prem_asn:n('vpnOnPremAsn'),azure_asn:n('vpnAzureAsn'),on_prem_peer_ip:v('vpnOnPremBgpPeerIp'),azure_peer_ip:v('vpnAzureBgpPeerIp')}}:undefined,
    point_to_site:p2s?{client_address_pool:v('p2sAddressPool'),tunnel_type:v('p2sTunnelType'),authentication:v('p2sAuthentication'),entra_tenant:v('p2sEntraTenant'),entra_audience:v('p2sEntraAudience'),root_certificate:v('p2sRootCertificate'),radius_servers:v('p2sRadiusServers'),radius_secret_ref:v('p2sRadiusSecretRef')}:undefined,
  }]:undefined

  const clusterNodes=rows('hosts').map(h=>({
    node_hostname:s(h.values.name),node_fqdn:s(h.values.fqdn),node_management_ip:s(h.values.managementIp),node_idrac_ip:s(h.values.bmcAddress),node_serial_number:s(h.values.serial),node_model:s(h.values.model),node_cluster:nameOf('clusters',h.values.cluster),
    node_bmc_oob:oob?{device:nameOf('oobDevices',h.values.bmcOobDevice),port:s(h.values.bmcOobPort)}:undefined,
    fc_hba:rows('storageSystems').some(sys=>sys.values.kind==='fc'&&sys.values.cluster===h.values.cluster)?rows('storageInterfaces').filter(i=>i.values.host===h.id&&i.values.protocol==='fc').map(i=>({port:s(i.values.port),wwpn:s(i.values.initiator),fabric:s(i.values.fabric),path:s(i.values.pathSide)})):undefined,
  }))
  const links=activeStorageLinks(project)
  const storage=(sys:DesignRecord)=>{
    const x=sys.values,kind=s(x.kind),hosts=new Set(rows('hosts').filter(h=>h.values.cluster===x.cluster).map(h=>h.id)),switchless=kind==='s2d'&&x.storageConnectivity==='switchless'
    const initiators=(protocol:string)=>rows('storageInterfaces').filter(i=>i.values.protocol===protocol&&hosts.has(String(i.values.host))).map(i=>({host:nameOf('hosts',i.values.host),port:s(i.values.port),initiator:s(i.values.initiator),fabric:s(i.values.fabric),path:s(i.values.pathSide),adapter:protocol==='iscsi'?nameOf('adapters',i.values.adapter):'',network:protocol==='iscsi'?nameOf('networks',i.values.network):''}))
    return {name:s(x.name),kind,vendor:s(x.vendor),
      s2d:kind==='s2d'?{connectivity:s(x.storageConnectivity),switchless_links_per_node_pair:switchless&&x.switchlessLinks?Number(x.switchlessLinks):undefined,
        switchless_links:switchless?links.filter(l=>l.values.storageSystem===sys.id).map(l=>({link:s(l.values.name),link_index:Number(l.values.linkIndex)||undefined,
          node_a:nameOf('hosts',l.values.hostA),adapter_a:nameOf('adapters',l.values.adapterA),port_a:s(l.values.portA),node_b:nameOf('hosts',l.values.hostB),adapter_b:nameOf('adapters',l.values.adapterB),port_b:s(l.values.portB),
          network:nameOf('networks',l.values.network),subnet:s(l.values.subnet),vlan:Number(l.values.vlan)||undefined})):undefined}:undefined,
      fibre_channel:kind==='fc'?{fabric_a:s(x.fcFabricA),fabric_b:s(x.fcFabricB),zoning:s(x.fcZoning),target_wwpns:s(x.fcTargetWwpns),mpio:s(x.mpio),initiators:initiators('fc')}:undefined,
      iscsi:kind==='iscsi'?{path_a:{network:nameOf('networks',x.iscsiNetworkA),vlan:Number(x.iscsiVlanA)||undefined},path_b:{network:nameOf('networks',x.iscsiNetworkB),vlan:Number(x.iscsiVlanB)||undefined},target_portals:s(x.iscsiPortals),target_iqn:s(x.iscsiTargetIqn),mtu:Number(x.iscsiMtu)||undefined,mpio:s(x.mpio),initiators:initiators('iscsi')}:undefined,
    }
  }
  const witnessTypes:Record<string,string>={file:'file_share_witness',cloud:'cloud_witness',disk:'disk_witness',none:'none'}
  const clusters=rows('clusters').map(c=>({cluster_name:s(c.values.name),cluster_fqdn:s(c.values.fqdn),cluster_ip:s(c.values.address),cluster_node_count:rows('hosts').filter(h=>h.values.cluster===c.id).length,
    cluster_witness_type:witnessTypes[s(c.values.witness)]||'',storage_systems:rows('storageSystems').filter(sys=>sys.values.cluster===c.id).map(storage)}))

  const tree={
    _metadata:{version:String(project.revision),schema_version:'4.0.0',last_updated:project.updatedAt.slice(0,10),environment_name:project.name,generator:'hyperv-configurator',generator_version:metadata.version,project_id:project.id,project_schema_version:project.schemaVersion,deployment_state:'not_executed_by_configurator'},
    decisions,
    networking:{
      onprem:{vlans,network_devices:devices,customer_firewall:componentUsed(project,'customerFirewall')?{vendor:v('customerFirewallVendor'),gateway_ips:v('customerFirewallGatewayIps'),owner:v('customerFirewallOwner')}:undefined},
      hybrid:{vpn:{vpn_gateways:vpnGateways}},
      express_route:er?{provider:v('erProvider'),circuit_name:v('erCircuitName'),peering_location:v('erPeeringLocation'),bandwidth_mbps:n('erBandwidthMbps'),sku:v('erSku'),private_peering:{primary_subnet:v('erPrimarySubnet'),secondary_subnet:v('erSecondarySubnet'),vlan_id:n('erVlanId'),peer_asn:n('erPeerAsn'),md5_key_ref:v('erMd5Ref')}}:undefined,
    },
    compute:{clusters:{hyperv:clusters},cluster_nodes:clusterNodes},
    operations:{
      bcdr:componentUsed(project,'backup')?{backup:{product:v('backupProductName'),level:v('backupLevel'),server_location:v('backupServerLocation'),network:nameOf('networks',d.backupNetwork),owner:v('backupServiceOwner')}}:undefined,
      monitoring:componentUsed(project,'monitoring')?{platform:v('monitoringPlatform'),log_analytics_workspace:v('monitoringWorkspace'),owner:v('monitoringServiceOwner'),network_device_logging:v('networkDeviceLogging')}:undefined,
    },
  }
  // Decisions always survive cleaning: they record "not used" answers as well as used ones.
  return {...(clean(tree) as Record<string,Tree>),decisions}
}

export function infrastructureYaml(project:Project):string{
  const {_metadata,decisions,...rest}=masterInfrastructure(project)
  const header=['# infrastructure.yml — Hyper-V Configurator design data (no scripts, not executed).','# Shape follows the Azure Local Toolkit infrastructure schema v4.0.0 / master-registry. Extension keys are listed in','# INFRASTRUCTURE_EXTENSIONS in apps/hyperv-configurator/src/infrastructureYaml.ts. Only components in use appear outside `decisions`.','']
  return header.join('\n')+dump({_metadata,decisions,...rest},{noRefs:true,sortKeys:false,lineWidth:110})
}
