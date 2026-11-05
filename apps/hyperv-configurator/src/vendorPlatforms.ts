/**
 * Vendor platforms offered for each infrastructure component. Every component question is vendor neutral; the platform
 * answer supplies the manufacturer and operating system written to exports. "other" asks for the vendor by name.
 * Add a vendor here and it appears in every question that uses the list.
 */
export interface Platform {label:string;vendor:string;os?:string;bmc?:string}
const p=(label:string,vendor:string,os?:string,bmc?:string):Platform=>({label,vendor,...(os?{os}:{}),...(bmc?{bmc}:{})})

export const firewallPlatforms:Record<string,Platform>={
  fortinet:p('Fortinet FortiGate (FortiOS)','Fortinet','FortiOS'),
  'palo-alto':p('Palo Alto Networks NGFW (PAN-OS)','Palo Alto Networks','PAN-OS'),
  cisco:p('Cisco Secure Firewall (Threat Defense / ASA)','Cisco','Cisco Secure Firewall Threat Defense / ASA'),
  checkpoint:p('Check Point Quantum (Gaia)','Check Point','Gaia'),
  sophos:p('Sophos Firewall (SFOS)','Sophos','SFOS'),
  juniper:p('Juniper SRX (Junos OS)','Juniper Networks','Junos OS'),
  other:p('Other vendor',''),
}

/** Used for top-of-rack and out-of-band management switches. */
export const switchPlatforms:Record<string,Platform>={
  'dell-os10':p('Dell PowerSwitch — SmartFabric OS10','Dell','SmartFabric OS10'),
  'dell-sonic':p('Dell PowerSwitch — Enterprise SONiC','Dell','Enterprise SONiC'),
  'cisco-nxos':p('Cisco Nexus — NX-OS','Cisco','NX-OS'),
  'cisco-iosxe':p('Cisco Catalyst — IOS XE','Cisco','IOS XE'),
  'aruba-cx':p('HPE Aruba Networking CX — AOS-CX','HPE Aruba Networking','AOS-CX'),
  juniper:p('Juniper — Junos OS','Juniper Networks','Junos OS'),
  arista:p('Arista — EOS','Arista','EOS'),
  'nvidia-cumulus':p('NVIDIA Spectrum — Cumulus Linux','NVIDIA','Cumulus Linux'),
  other:p('Other vendor',''),
}

export const consoleServerPlatforms:Record<string,Platform>={
  opengear:p('Opengear','Opengear'),
  lantronix:p('Lantronix','Lantronix'),
  vertiv:p('Vertiv Avocent','Vertiv'),
  digi:p('Digi','Digi International'),
  perle:p('Perle','Perle Systems'),
  other:p('Other vendor',''),
}

/** Physical server platforms and the name of their management controller (BMC). */
export const serverPlatforms:Record<string,Platform>={
  dell:p('Dell PowerEdge','Dell',undefined,'iDRAC'),
  hpe:p('HPE ProLiant','HPE',undefined,'iLO'),
  lenovo:p('Lenovo ThinkSystem','Lenovo',undefined,'XClarity Controller (XCC)'),
  dataon:p('DataON','DataON',undefined,'BMC (Redfish / IPMI)'),
  cisco:p('Cisco UCS','Cisco',undefined,'Cisco IMC'),
  supermicro:p('Supermicro','Supermicro',undefined,'BMC (Redfish / IPMI)'),
  other:p('Other vendor',''),
}

/** Hardware management appliances. Dell OME carries the built-in sizing and plug-in catalog; the others use vendor sizing review. */
export const hardwareManagers:Record<string,Platform>={
  'dell-ome':p('Dell OpenManage Enterprise','Dell','OpenManage Enterprise'),
  'hpe-oneview':p('HPE OneView','HPE','OneView'),
  'lenovo-xclarity':p('Lenovo XClarity Administrator','Lenovo','XClarity Administrator'),
  other:p('Other hardware management appliance',''),
}

/** Select options for a platform list. */
export const platformOptions=(platforms:Record<string,Platform>)=>Object.fromEntries(Object.entries(platforms).map(([key,platform])=>[key,platform.label]))
/** The manufacturer for an answer; "other" uses the vendor typed by the user. */
export const platformVendor=(platforms:Record<string,Platform>,key:unknown,other:unknown='')=>{const k=String(key??'');return k==='other'?String(other??'').trim():platforms[k]?.vendor??''}
export const platformOs=(platforms:Record<string,Platform>,key:unknown)=>platforms[String(key??'')]?.os??''
