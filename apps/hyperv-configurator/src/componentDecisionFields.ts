import type {Field,Collection,Answers} from './catalog'
/**
 * Schema 31 component decisions. Every infrastructure component starts with an "is it used?" (or which-option)
 * gate. The gate reveals only the follow-up questions that apply; a "not used" answer hides them, keeps the saved
 * answers in the project, and removes the component from infrastructure.yml and environment exports.
 * Platform capability comes from Microsoft Learn and vendor documentation; TierPoint documents only inform
 * defaults, naming and help text.
 */
const text=(key:string,label:string,hint?:string):Field=>({key,label,type:'text',...(hint?{hint}:{})})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const num=(key:string,label:string,min=0,max=1e9):Field=>({key,label,type:'number',min,max})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const required=(f:Field):Field=>({...f,required:true})
const on=(f:Field,key:string,...values:string[]):Field=>({...f,when:{key,values}})
const onAny=(f:Field,...conditions:[string,string[]][]):Field=>({...f,whenAny:conditions.map(([key,values])=>({key,values}))})
const both=(f:Field,gate:[string,string[]],detail:[string,string[]]):Field=>({...f,when:{key:detail[0],values:detail[1]},whenAny:[{key:gate[0],values:gate[1]}]})
const used={yes:'Used in this design',no:'Not used in this design'}
const priorities=Object.fromEntries(Array.from({length:8},(_,i)=>[String(i),i===3?'3 (SMB Direct default)':i===7?'7 (cluster heartbeat default)':String(i)]))

export const FORTIGATE=['tierpoint-fortigate'],FIREWALL=['tierpoint-fortigate','customer'],TOR=['dell-powerswitch','customer'],OOB=['oob-switch','opengear'],YES=['yes']

/** Gate questions, in the order they are asked. */
export const decisionGates={
  firewallProvider:{component:'firewall',section:'network'},siteToSiteVpn:{component:'site_to_site_vpn',section:'network'},pointToSiteVpn:{component:'point_to_site_vpn',section:'network'},expressRoute:{component:'expressroute',section:'network'},
  torProvider:{component:'tor_switches',section:'network'},oobModel:{component:'out_of_band_management',section:'network'},backupInScope:{component:'backup',section:'operations'},monitoringInScope:{component:'monitoring',section:'operations'},
} as const
export type DecisionGate=keyof typeof decisionGates

export const networkDecisionFields:Field[]=[
  required(choice('firewallProvider','Firewall in this design',{'tierpoint-fortigate':'Yes — TierPoint-managed Fortinet FortiGate','customer':'Yes — customer-owned firewall',none:'No firewall in this design'})),
  on(text('fwModel','FortiGate model'),'firewallProvider',...FORTIGATE),
  on(choice('fwHaMode','Firewall high-availability mode',{'active-passive':'Active-passive HA pair','active-active':'Active-active HA pair',standalone:'Standalone unit (no HA)'}),'firewallProvider',...FORTIGATE),
  on(text('fwFirmware','FortiOS version'),'firewallProvider',...FORTIGATE),
  on(notes('fwWanIps','Firewall WAN / public IP addresses and ISP handoff'),'firewallProvider',...FORTIGATE),
  on(notes('fwVdoms','Firewall VDOMs and their purpose'),'firewallProvider',...FORTIGATE),
  on(required(text('customerFirewallVendor','Customer firewall vendor and model')),'firewallProvider','customer'),
  on(text('customerFirewallGatewayIps','Gateway IP addresses on the customer firewall'),'firewallProvider','customer'),
  on(required(text('customerFirewallOwner','Customer firewall owner and contact')),'firewallProvider','customer'),

  required(choice('siteToSiteVpn','Azure site-to-site VPN',used)),
  on(text('vpnOnPremPublicIp','On-premises VPN public IP address or FQDN'),'siteToSiteVpn',...YES),
  on(text('vpnOnPremDevice','On-premises VPN device'),'siteToSiteVpn',...YES),
  onAny(choice('vpnGatewaySku','Azure VPN gateway SKU',{VpnGw1AZ:'VpnGw1AZ',VpnGw2AZ:'VpnGw2AZ',VpnGw3AZ:'VpnGw3AZ',VpnGw4AZ:'VpnGw4AZ',VpnGw5AZ:'VpnGw5AZ',Basic:'Basic (no BGP, no IKEv2 P2S, no RADIUS)'}),['siteToSiteVpn',YES],['pointToSiteVpn',YES]),
  onAny(choice('vpnActiveActive','Azure VPN gateway mode',{yes:'Active-active',no:'Active-standby'}),['siteToSiteVpn',YES],['pointToSiteVpn',YES]),
  onAny(text('vpnGatewaySubnet','Azure GatewaySubnet prefix'),['siteToSiteVpn',YES],['pointToSiteVpn',YES]),
  on(text('vpnAzureAddressSpaces','Azure address spaces reached over the VPN'),'siteToSiteVpn',...YES),
  on(text('vpnOnPremAddressSpaces','On-premises address spaces sent to Azure'),'siteToSiteVpn',...YES),
  on(choice('vpnIkeVersion','IKE version',{ikev2:'IKEv2',ikev1:'IKEv1'}),'siteToSiteVpn',...YES),
  on(choice('vpnIpsecPolicy','IPsec / IKE policy',{default:'Azure default policy',custom:'Custom policy'}),'siteToSiteVpn',...YES),
  both(notes('vpnCustomPolicy','Custom IKE and IPsec parameters'),['siteToSiteVpn',YES],['vpnIpsecPolicy',['custom']]),
  on(text('vpnSharedKeyRef','VPN shared key reference'),'siteToSiteVpn',...YES),
  on(choice('vpnBgp','VPN routing',{yes:'BGP',no:'Static routes'}),'siteToSiteVpn',...YES),
  both(num('vpnOnPremAsn','On-premises BGP ASN',0,4294967295),['siteToSiteVpn',YES],['vpnBgp',YES]),
  both(num('vpnAzureAsn','Azure VPN gateway BGP ASN',0,4294967295),['siteToSiteVpn',YES],['vpnBgp',YES]),
  both(text('vpnOnPremBgpPeerIp','On-premises BGP peer IP'),['siteToSiteVpn',YES],['vpnBgp',YES]),
  both(text('vpnAzureBgpPeerIp','Azure BGP peer IP'),['siteToSiteVpn',YES],['vpnBgp',YES]),

  required(choice('pointToSiteVpn','Point-to-site VPN',used)),
  on(text('p2sAddressPool','Point-to-site client address pool'),'pointToSiteVpn',...YES),
  on(choice('p2sTunnelType','Point-to-site tunnel type',{openvpn:'OpenVPN',ikev2:'IKEv2','ikev2-openvpn':'IKEv2 and OpenVPN',sstp:'SSTP (being retired)','ikev2-sstp':'IKEv2 and SSTP (SSTP being retired)'}),'pointToSiteVpn',...YES),
  on(choice('p2sAuthentication','Point-to-site authentication',{entra:'Microsoft Entra ID',certificate:'Certificate',radius:'RADIUS'}),'pointToSiteVpn',...YES),
  both(text('p2sEntraTenant','Entra tenant URL'),['pointToSiteVpn',YES],['p2sAuthentication',['entra']]),
  both(text('p2sEntraAudience','Entra audience (application ID)'),['pointToSiteVpn',YES],['p2sAuthentication',['entra']]),
  both(text('p2sRootCertificate','Root certificate name or thumbprint'),['pointToSiteVpn',YES],['p2sAuthentication',['certificate']]),
  both(text('p2sRadiusServers','RADIUS server addresses'),['pointToSiteVpn',YES],['p2sAuthentication',['radius']]),
  both(text('p2sRadiusSecretRef','RADIUS shared secret reference'),['pointToSiteVpn',YES],['p2sAuthentication',['radius']]),

  required(choice('expressRoute','ExpressRoute / private connectivity',used)),
  on(text('erProvider','ExpressRoute connectivity provider'),'expressRoute',...YES),
  on(text('erCircuitName','ExpressRoute circuit name'),'expressRoute',...YES),
  on(text('erPeeringLocation','ExpressRoute peering location'),'expressRoute',...YES),
  on(num('erBandwidthMbps','ExpressRoute bandwidth (Mbps)'),'expressRoute',...YES),
  on(choice('erSku','ExpressRoute circuit SKU',{local:'Local',standard:'Standard',premium:'Premium'}),'expressRoute',...YES),
  on(text('erPrimarySubnet','Private peering primary subnet'),'expressRoute',...YES),
  on(text('erSecondarySubnet','Private peering secondary subnet'),'expressRoute',...YES),
  on(num('erVlanId','Private peering VLAN ID',0,4094),'expressRoute',...YES),
  on(num('erPeerAsn','Private peering customer ASN',0,4294967295),'expressRoute',...YES),
  on(text('erMd5Ref','Private peering MD5 key reference'),'expressRoute',...YES),

  required(choice('torProvider','Top-of-rack switches',{'dell-powerswitch':'Dell PowerSwitch (TierPoint-supplied)',customer:'Customer-owned switches',none:'No top-of-rack switches in scope'})),
  on(required(text('torVendor','Customer switch vendor')),'torProvider','customer'),
  on(text('torOwner','Customer switch owner and contact'),'torProvider','customer'),
  on(text('torModel','ToR switch model'),'torProvider',...TOR),
  on(choice('torOs','ToR switch operating system',{os10:'Dell SmartFabric OS10',sonic:'Enterprise SONiC',other:'Other vendor OS'}),'torProvider',...TOR),
  on(text('torOsVersion','ToR operating system version'),'torProvider',...TOR),
  on(choice('torPairMode','ToR pairing',{vlt:'Dell VLT pair',mlag:'MLAG / vPC pair',single:'Single switch'}),'torProvider',...TOR),
  both(text('torVltDomain','VLT / MLAG domain ID'),['torProvider',TOR],['torPairMode',['vlt','mlag']]),
  both(text('torPeerLinkPorts','Peer-link (VLTi) ports'),['torProvider',TOR],['torPairMode',['vlt','mlag']]),
  on(notes('torUplinks','ToR uplinks to core or firewall'),'torProvider',...TOR),
  on(num('torMtu','ToR port MTU',0,9216),'torProvider',...TOR),
  // Shown only when an S2D storage system is switched (see switchedStorageKeys).
  on(text('torStorageVlans','Storage / SMB VLANs on the ToR switches'),'torProvider',...TOR),
  on(choice('torRdma','Storage RDMA type',{roce:'RoCEv2',iwarp:'iWARP',none:'RDMA disabled'}),'torProvider',...TOR),
  on(choice('torSmbPriority','PFC priority for SMB Direct',priorities),'torProvider',...TOR),
  on(choice('torClusterPriority','Priority for cluster heartbeat',priorities),'torProvider',...TOR),
  on(num('torEtsSmbPercent','ETS bandwidth for SMB Direct (%)',0,100),'torProvider',...TOR),
  on(num('torEtsClusterPercent','ETS bandwidth for cluster heartbeat (%)',0,100),'torProvider',...TOR),

  required(choice('oobModel','Out-of-band management',{'oob-switch':'Standard OOB management switch',opengear:'Opengear with Lighthouse',none:'No OOB network in scope'})),
  on(num('oobVlan','OOB VLAN ID',0,4094),'oobModel',...OOB),
  on(ref('oobNetwork','OOB network','networks'),'oobModel',...OOB),
  on(choice('lighthouseInstance','Lighthouse instance',{existing:'Existing shared Lighthouse',new:'New Lighthouse for this design'}),'oobModel','opengear'),
  on(text('lighthouseAddress','Lighthouse server address'),'oobModel','opengear'),
  on(num('lighthousePort','Lighthouse enrollment port',0,65535),'oobModel','opengear'),
  on(text('lighthouseEnrollmentAuthRef','Lighthouse enrollment token reference'),'oobModel','opengear'),
  on(text('lighthouseEnrollmentBundle','Lighthouse enrollment bundle'),'oobModel','opengear'),
]
/** Fields that also require a switched S2D storage system before they apply. */
export const switchedStorageKeys=['torStorageVlans','torRdma','torSmbPriority','torClusterPriority','torEtsSmbPercent','torEtsClusterPercent']

export const operationsDecisionFields:Field[]=[
  required(choice('backupInScope','Backup in this design',used)),
  on(text('backupProductName','Backup product and version'),'backupInScope',...YES),
  on(choice('backupLevel','Backup level',{host:'Host-level (whole VM)',guest:'Guest-level (agent in the VM)',both:'Host-level and guest-level'}),'backupInScope',...YES),
  on(text('backupServerLocation','Backup server or appliance location'),'backupInScope',...YES),
  on(ref('backupNetwork','Dedicated backup network','networks'),'backupInScope',...YES),
  on(text('backupServiceOwner','Backup service owner'),'backupInScope',...YES),
  required(choice('monitoringInScope','Monitoring in this design',used)),
  on(choice('monitoringPlatform','Monitoring platform',{scom:'System Center Operations Manager','azure-monitor':'Azure Monitor','tierpoint-noc':'TierPoint NOC tooling',customer:'Customer monitoring tool',other:'Other'}),'monitoringInScope',...YES),
  both(text('monitoringWorkspace','Log Analytics workspace'),['monitoringInScope',YES],['monitoringPlatform',['azure-monitor']]),
  on(text('monitoringServiceOwner','Monitoring service owner'),'monitoringInScope',...YES),
  on(text('networkDeviceLogging','Syslog / SNMP destination for network devices'),'monitoringInScope',...YES),
]
export const decisionFields:Field[]=[...networkDecisionFields,...operationsDecisionFields]
export const decisionSecretKeys=['vpnSharedKeyRef','p2sRadiusSecretRef','erMd5Ref','lighthouseEnrollmentAuthRef'] // gitleaks:allow field names, not secrets

const identity=(label:string)=>[required(text('name',label)),text('owner','Owner')]
const role=choice('role','Device role',{primary:'Primary',secondary:'Secondary',standalone:'Standalone'})
export const networkDeviceCollections:Collection[]=[
  {key:'firewallDevices',title:'Firewall units',singular:'firewall unit',section:'network',description:'One record per FortiGate unit. An HA pair is two records, primary and secondary. Shown only when the design uses TierPoint-managed firewalls.',fields:[
    ...identity('Firewall hostname'),required(role),required(text('managementIp','Management IP address')),text('serial','Serial number'),text('wanIp','WAN / public IP address'),num('haPriority','HA priority',0,255),text('rack','Rack position'),notes('notes','Firewall notes'),
  ]},
  {key:'firewallInterfaces',title:'Firewall interfaces',singular:'firewall interface',section:'network',description:'One record per firewall port: WAN, HA sync, OOB or a link to a top-of-rack switch port.',fields:[
    ...identity('Firewall port'),required(ref('firewall','Firewall unit','firewallDevices')),required(choice('purpose','Interface purpose',{wan:'WAN / internet','tor-uplink':'Link to a ToR switch','ha-sync':'HA heartbeat / sync',oob:'OOB / management',other:'Other'})),
    on(ref('torSwitch','Connected ToR switch','torSwitches'),'purpose','tor-uplink'),on(text('torPort','Connected ToR switch port'),'purpose','tor-uplink'),text('vlans','VLANs carried'),num('speedGbps','Link speed (Gbps)'),
  ]},
  {key:'firewallGateways',title:'Firewall VLAN gateways and DHCP',singular:'firewall gateway',section:'network',description:'The VLAN gateways that live on the firewall, with the DHCP scope or relay the firewall provides on each.',fields:[
    ...identity('Gateway interface name'),required(ref('network','Network / VLAN','networks')),required(text('gatewayIp','Gateway IP address')),text('vdom','VDOM'),
    choice('dhcp','DHCP on this VLAN',{none:'No DHCP on the firewall',server:'Firewall DHCP server',relay:'DHCP relay'}),on(text('dhcpStart','DHCP scope start'),'dhcp','server'),on(text('dhcpEnd','DHCP scope end'),'dhcp','server'),on(notes('dhcpReservations','DHCP reservations'),'dhcp','server'),on(text('dhcpRelayTarget','DHCP relay server'),'dhcp','relay'),
  ]},
  {key:'torSwitches',title:'Top-of-rack switches',singular:'ToR switch',section:'network',description:'One record per top-of-rack switch. Pair, OS and DCB settings are recorded once in the component decisions above.',fields:[
    ...identity('Switch hostname'),required(role),required(text('managementIp','Management IP address')),text('serial','Serial / service tag'),text('rack','Rack position'),text('uplinkPorts','Uplink ports'),
  ]},
  {key:'oobDevices',title:'Out-of-band devices',singular:'OOB device',section:'network',description:'The OOB management switch or Opengear appliance that BMC, switch and firewall management ports connect to.',fields:[
    ...identity('Device hostname'),text('vendor','OOB switch vendor'),text('model','Device model'),required(text('managementIp','Management IP address')),num('vlan','OOB VLAN ID',0,4094),text('uplink','Uplink (device and port)'),text('serial','Serial number'),text('rack','Rack position'),
    num('serialPortCount','Serial console ports',0,96),choice('cellularFailover','Cellular failover',{cellular:'Cellular failover',none:'No cellular failover'}),on(text('cellularApn','Cellular APN'),'cellularFailover','cellular'),
  ]},
  {key:'consolePorts',title:'Console port map',singular:'console port',section:'network',description:'One record per Opengear serial port and the device console it connects to.',fields:[
    ...identity('Port label'),required(ref('consoleServer','Opengear appliance','oobDevices')),num('portNumber','Serial port number',0,96),required(choice('targetKind','Connected device type',{tor:'ToR switch',firewall:'Firewall unit',host:'Physical host',other:'Other device'})),
    on(ref('targetTor','Connected ToR switch','torSwitches'),'targetKind','tor'),on(ref('targetFirewall','Connected firewall unit','firewallDevices'),'targetKind','firewall'),on(ref('targetHost','Connected host','hosts'),'targetKind','host'),on(text('targetOther','Connected device'),'targetKind','other'),
    choice('pinout','Port pinout',{'cisco-rolled':'Cisco rolled','cisco-straight':'Cisco straight'}),choice('baud','Baud rate',{'9600':'9600','115200':'115200',other:'Other'}),
  ]},
]
export const networkDeviceKeys=networkDeviceCollections.map(c=>c.key)

/**
 * Schema 32: the switchless S2D cable map. One record per direct storage cable between two nodes of the same cluster.
 * Shown only while an S2D storage system is switchless (records are kept when the design changes).
 */
export const storageLinksCollection:Collection={key:'storageLinks',title:'Switchless storage cable map',singular:'storage link',section:'storage',
  description:'One record per direct node-to-node storage cable for a switchless S2D system. Every pair of nodes needs the chosen number of links, and each adapter port carries one link only.',fields:[
    required(text('name','Link label')),required(ref('storageSystem','Switchless S2D storage system','storageSystems')),num('linkIndex','Link number for this node pair',0,2),
    required(ref('hostA','Node A','hosts')),required(ref('adapterA','Node A storage adapter','adapters')),text('portA','Node A adapter port'),
    required(ref('hostB','Node B','hosts')),required(ref('adapterB','Node B storage adapter','adapters')),text('portB','Node B adapter port'),
    ref('network','Storage network','networks'),text('subnet','Link subnet'),num('vlan','Link VLAN ID',0,4094),
  ]}
export const STORAGE_LINKS_KEY='storageLinks'

/** New fields on existing records in schema 31: port maps, S2D connectivity and SAN protocol details. */
export const networkDecisionV31Fields=[
  ['adapters',[ref('torSwitch','Connected ToR switch','torSwitches'),text('torPort','Connected ToR switch port')]],
  ['hosts',[ref('bmcOobDevice','BMC OOB device','oobDevices'),text('bmcOobPort','BMC OOB device port')]],
  ['storageSystems',[
    on(choice('storageConnectivity','S2D storage connectivity',{switched:'Switched (through the ToR switches)',switchless:'Switchless (direct node-to-node links)'}),'kind','s2d'),
    both(choice('switchlessLinks','Direct links per node pair',{'1':'One link per node pair','2':'Two links per node pair'}),['kind',['s2d']],['storageConnectivity',['switchless']]),
    on(text('fcFabricA','Fibre Channel fabric A switch'),'kind','fc'),on(text('fcFabricB','Fibre Channel fabric B switch'),'kind','fc'),
    on(choice('fcZoning','Fibre Channel zoning',{'single-initiator':'Single-initiator / single-target zones by WWPN',other:'Other zoning (review)'}),'kind','fc'),on(notes('fcTargetWwpns','Array target WWPNs'),'kind','fc'),
    on(ref('iscsiNetworkA','iSCSI path A network','networks'),'kind','iscsi'),on(ref('iscsiNetworkB','iSCSI path B network','networks'),'kind','iscsi'),
    on(num('iscsiVlanA','iSCSI path A VLAN',0,4094),'kind','iscsi'),on(num('iscsiVlanB','iSCSI path B VLAN',0,4094),'kind','iscsi'),
    on(text('iscsiPortals','iSCSI target portal addresses'),'kind','iscsi'),on(text('iscsiTargetIqn','iSCSI target IQN'),'kind','iscsi'),on(num('iscsiMtu','iSCSI MTU',0,9216),'kind','iscsi'),
  ]],
  ['storageInterfaces',[choice('pathSide','Fabric / path side',{a:'Fabric / path A',b:'Fabric / path B'})]],
] as const satisfies readonly (readonly [string,Field[]])[]

export const decisionValue=(answers:Answers,key:DecisionGate)=>String(answers[key]??'')
